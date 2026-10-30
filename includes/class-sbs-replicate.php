<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Replicate
{
    const BASE = 'https://api.replicate.com/v1';
    const DEFAULT_VERSION = 'e84596a7e0bd288ffc063ec00d224fa20b70152f1ce4aa14db21bc1f0bff00b6';

    public static function api_key()
    {
        return SBS_Crypto::setting('SBS_REPLICATE_API_TOKEN', 'sbs_replicate_api_token');
    }

    public static function is_configured()
    {
        return self::api_key() !== '';
    }

    // Keep the provider input below its 2,096,704-pixel hardware limit.
    public static function input_size($width, $height)
    {
        $ratio = min(1, sqrt(2000000 / max(1, $width * $height)));
        return array(max(1, (int) floor($width * $ratio)), max(1, (int) floor($height * $ratio)));
    }

    public static function submit($asset_id, $scale)
    {
        $data_url = SBS_Storage::data_url($asset_id);
        if (is_wp_error($data_url)) {
            return $data_url;
        }
        $bytes = base64_decode(substr($data_url, strpos($data_url, ',') + 1), true);
        $size = $bytes ? @getimagesizefromstring($bytes) : false;
        if (!$size) { return new WP_Error('upscale_input', 'The upscale input could not be read. Original retained.'); }
        $input = self::input_size($size[0], $size[1]);
        if ($input[0] !== $size[0] || $input[1] !== $size[1]) {
            $tmp = wp_tempnam('sbs-upscale-input');
            if (!$tmp) { return new WP_Error('upscale_temp', 'Could not prepare the upscale input.'); }
            $output = null;
            try {
                if (file_put_contents($tmp, $bytes) === false) { return new WP_Error('upscale_input', 'Could not prepare the upscale input.'); }
                $editor = wp_get_image_editor($tmp);
                if (is_wp_error($editor)) { return $editor; }
                $resized = $editor->resize($input[0], $input[1], false);
                if (is_wp_error($resized)) { return $resized; }
                $saved = $editor->save($tmp . '.png', 'image/png');
                if (is_wp_error($saved)) { return $saved; }
                $output = $saved['path'];
                $prepared = file_get_contents($output);
                $actual = @getimagesizefromstring($prepared);
                if (!$actual || $actual[0] * $actual[1] > 2000000) { return new WP_Error('upscale_input', 'The resized input exceeds the provider limit. No request sent.'); }
                $input = array($actual[0], $actual[1]);
                $data_url = 'data:image/png;base64,' . base64_encode($prepared);
            } finally {
                @unlink($tmp);
                if ($output && is_file($output)) { @unlink($output); }
                if (is_file($tmp . '.png')) { @unlink($tmp . '.png'); }
            }
        }
        $scale = in_array((int) $scale, array(2, 4), true) ? (int) $scale : 2;
        $result = self::request('POST', '/predictions', array(
            'version' => sanitize_text_field(get_option('sbs_replicate_model_version', self::DEFAULT_VERSION)),
            'input' => array(
                'image' => $data_url,
                'scale' => $scale,
                'face_enhance' => false,
            ),
        ));
        if (!is_wp_error($result)) { $result['_studio_input'] = $input; }
        return $result;
    }

    public static function poll($prediction_id)
    {
        if (!preg_match('/^[A-Za-z0-9_\-]+$/', $prediction_id)) {
            return new WP_Error('invalid_prediction_id', 'Invalid Replicate prediction identifier.');
        }
        return self::request('GET', '/predictions/' . rawurlencode($prediction_id));
    }

    public static function cancel($prediction_id)
    {
        if (!preg_match('/^[A-Za-z0-9_\-]+$/', $prediction_id)) {
            return new WP_Error('invalid_prediction_id', 'Invalid Replicate prediction identifier.');
        }
        return self::request('POST', '/predictions/' . rawurlencode($prediction_id) . '/cancel', array());
    }

    public static function fetch_output($url)
    {
        if (!wp_http_validate_url($url) || strtolower((string) wp_parse_url($url, PHP_URL_SCHEME)) !== 'https') {
            return new WP_Error('invalid_output_url', 'Replicate returned an invalid output URL.');
        }
        $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
        if (!self::host_matches($host, 'replicate.com') && !self::host_matches($host, 'replicate.delivery')) {
            return new WP_Error('untrusted_output_url', 'Replicate returned an untrusted output host.');
        }
        $response = wp_safe_remote_get($url, array('timeout' => 60, 'redirection' => 2));
        if (is_wp_error($response)) {
            return $response;
        }
        if ((int) wp_remote_retrieve_response_code($response) !== 200) {
            return new WP_Error('upscale_download_failed', 'Could not download the completed upscale.');
        }
        return wp_remote_retrieve_body($response);
    }

    private static function host_matches($host, $trusted)
    {
        return $host === $trusted || substr($host, -(strlen($trusted) + 1)) === '.' . $trusted;
    }

    private static function request($method, $path, $payload = null)
    {
        $key = self::api_key();
        if (!$key) {
            return new WP_Error('replicate_not_configured', 'The Replicate API token has not been configured.', array('status' => 503));
        }
        $args = array(
            'method' => $method,
            'timeout' => 45,
            'redirection' => 0,
            'headers' => array(
                'Authorization' => 'Bearer ' . $key,
                'Content-Type' => 'application/json',
                'Prefer' => 'wait=5',
                'User-Agent' => 'SmuttyBearStudio/' . SBS_VERSION,
            ),
        );
        if ($payload !== null) {
            $args['body'] = wp_json_encode($payload);
        }
        $response = wp_remote_request(self::BASE . $path, $args);
        if (is_wp_error($response)) {
            return $response;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if ($code < 200 || $code >= 300) {
            return new WP_Error('replicate_error', isset($body['detail']) ? $body['detail'] : 'Replicate request failed.', array('status' => $code, 'provider_error' => $body));
        }
        return is_array($body) ? $body : array();
    }
}
