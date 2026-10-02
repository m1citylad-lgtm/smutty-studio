<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Crypto
{
    public static function encrypt($plaintext)
    {
        if ($plaintext === '' || $plaintext === null) {
            return '';
        }
        if (!function_exists('openssl_encrypt')) {
            return '';
        }
        $key = hash('sha256', wp_salt('auth') . wp_salt('secure_auth'), true);
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            return '';
        }
        return 'gcm:' . base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt($stored)
    {
        if (!$stored) {
            return '';
        }
        if (strpos($stored, 'gcm:') !== 0 || !function_exists('openssl_decrypt')) {
            return '';
        }
        $raw = base64_decode(substr($stored, 4), true);
        if ($raw === false || strlen($raw) < 29) {
            return '';
        }
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $key = hash('sha256', wp_salt('auth') . wp_salt('secure_auth'), true);
        $value = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return $value === false ? '' : $value;
    }

    public static function setting($constant, $option)
    {
        if (defined($constant) && constant($constant)) {
            return (string) constant($constant);
        }
        return self::decrypt((string) get_option($option, ''));
    }
}
