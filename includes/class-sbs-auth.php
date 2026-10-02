<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Auth
{
    const COOKIE = 'sbs_studio_session';
    const UPDATE_COOKIE = 'sbs_update_session';
    const UPDATE_SESSION_SECONDS = 900;

    public static function password_is_set()
    {
        return (bool) get_option('sbs_password_hash');
    }

    public static function set_password($password)
    {
        if (strlen($password) < 8) {
            return new WP_Error('weak_password', 'The studio password must be at least eight characters.');
        }
        update_option('sbs_password_hash', password_hash($password, PASSWORD_DEFAULT), false);
        self::revoke_all();
        self::revoke_update_sessions();
        return true;
    }

    public static function update_access_is_configured()
    {
        return self::password_is_set();
    }

    public static function update_login($password)
    {
        if (!self::is_authenticated()) {
            return new WP_Error('studio_auth_required', 'Enter the studio before unlocking updates.', array('status' => 401));
        }
        $attempt_key = 'sbs_update_attempt_' . self::update_attempt_key();
        $attempt = get_transient($attempt_key);
        $attempt = is_array($attempt) ? $attempt : array('attempts' => 0, 'blocked_until' => 0);
        if (!empty($attempt['blocked_until']) && (int) $attempt['blocked_until'] > time()) {
            return new WP_Error('update_login_throttled', 'Too many update-password attempts. Try again later.', array('status' => 429));
        }
        $hash = (string) get_option('sbs_password_hash');
        if (!$hash || !password_verify((string) $password, $hash)) {
            $attempt['attempts'] = (int) $attempt['attempts'] + 1;
            $attempt['blocked_until'] = $attempt['attempts'] >= 5 ? time() + (30 * MINUTE_IN_SECONDS) : 0;
            set_transient($attempt_key, $attempt, 30 * MINUTE_IN_SECONDS);
            return new WP_Error('invalid_studio_reconfirmation', 'The Studio password is incorrect.', array('status' => 401));
        }
        delete_transient($attempt_key);
        $raw = bin2hex(random_bytes(32));
        $expires = time() + self::UPDATE_SESSION_SECONDS;
        set_transient('sbs_update_session_' . hash('sha256', $raw), array(
            'ip_hash' => self::ip_hash(),
            'generation' => (string) get_option('sbs_update_session_generation', ''),
            'expires_at' => $expires,
        ), self::UPDATE_SESSION_SECONDS);
        setcookie(self::UPDATE_COOKIE, $raw, array(
            'expires' => $expires,
            'path' => COOKIEPATH ? COOKIEPATH : '/',
            'domain' => COOKIE_DOMAIN,
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Strict',
        ));
        $_COOKIE[self::UPDATE_COOKIE] = $raw;
        return true;
    }

    public static function is_update_authenticated()
    {
        if (!self::is_authenticated()) {
            return false;
        }
        $raw = isset($_COOKIE[self::UPDATE_COOKIE]) ? (string) $_COOKIE[self::UPDATE_COOKIE] : '';
        if (!preg_match('/^[a-f0-9]{64}$/', $raw)) {
            return false;
        }
        $session = get_transient('sbs_update_session_' . hash('sha256', $raw));
        return is_array($session)
            && !empty($session['expires_at'])
            && (int) $session['expires_at'] > time()
            && !empty($session['ip_hash'])
            && hash_equals((string) $session['ip_hash'], self::ip_hash())
            && hash_equals((string) ($session['generation'] ?? ''), (string) get_option('sbs_update_session_generation', ''));
    }

    public static function update_logout()
    {
        $raw = isset($_COOKIE[self::UPDATE_COOKIE]) ? (string) $_COOKIE[self::UPDATE_COOKIE] : '';
        if (preg_match('/^[a-f0-9]{64}$/', $raw)) {
            delete_transient('sbs_update_session_' . hash('sha256', $raw));
        }
        setcookie(self::UPDATE_COOKIE, '', time() - HOUR_IN_SECONDS, COOKIEPATH ? COOKIEPATH : '/', COOKIE_DOMAIN, is_ssl(), true);
        unset($_COOKIE[self::UPDATE_COOKIE]);
    }

    public static function revoke_update_sessions()
    {
        update_option('sbs_update_session_generation', wp_generate_password(32, false, false), false);
        self::update_logout();
    }

    public static function login($password, $adult_confirmed)
    {
        global $wpdb;
        if (!$adult_confirmed) {
            return new WP_Error('adult_confirmation_required', 'Confirm that you are an adult to enter the studio.', array('status' => 400));
        }
        $key = self::attempt_key();
        $attempts_table = SBS_DB::table('login_attempts');
        $attempt = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$attempts_table} WHERE key_hash = %s", $key), ARRAY_A);
        if ($attempt && $attempt['blocked_until'] && strtotime($attempt['blocked_until'] . ' UTC') > time()) {
            return new WP_Error('login_throttled', 'Too many attempts. Try again later.', array('status' => 429));
        }
        $hash = (string) get_option('sbs_password_hash');
        if (!$hash || !password_verify((string) $password, $hash)) {
            $count = $attempt ? ((int) $attempt['attempts'] + 1) : 1;
            $blocked = $count >= 5 ? gmdate('Y-m-d H:i:s', time() + 15 * MINUTE_IN_SECONDS) : null;
            $wpdb->replace($attempts_table, array(
                'key_hash' => $key,
                'attempts' => $count,
                'blocked_until' => $blocked,
                'updated_at' => current_time('mysql', true),
            ));
            return new WP_Error('invalid_password', 'The studio password is incorrect.', array('status' => 401));
        }
        $wpdb->delete($attempts_table, array('key_hash' => $key));
        $raw = bin2hex(random_bytes(32));
        $expires = time() + 7 * DAY_IN_SECONDS;
        $wpdb->insert(SBS_DB::table('sessions'), array(
            'token_hash' => hash('sha256', $raw),
            'ip_hash' => self::ip_hash(),
            'expires_at' => gmdate('Y-m-d H:i:s', $expires),
            'created_at' => current_time('mysql', true),
            'last_seen_at' => current_time('mysql', true),
        ));
        setcookie(self::COOKIE, $raw, array(
            'expires' => $expires,
            'path' => COOKIEPATH ? COOKIEPATH : '/',
            'domain' => COOKIE_DOMAIN,
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ));
        $_COOKIE[self::COOKIE] = $raw;
        return true;
    }

    public static function logout()
    {
        global $wpdb;
        self::update_logout();
        $raw = isset($_COOKIE[self::COOKIE]) ? (string) $_COOKIE[self::COOKIE] : '';
        if ($raw) {
            $wpdb->delete(SBS_DB::table('sessions'), array('token_hash' => hash('sha256', $raw)));
        }
        setcookie(self::COOKIE, '', time() - HOUR_IN_SECONDS, COOKIEPATH ? COOKIEPATH : '/', COOKIE_DOMAIN, is_ssl(), true);
        unset($_COOKIE[self::COOKIE]);
    }

    public static function is_authenticated()
    {
        global $wpdb;
        $raw = isset($_COOKIE[self::COOKIE]) ? (string) $_COOKIE[self::COOKIE] : '';
        if (!preg_match('/^[a-f0-9]{64}$/', $raw)) {
            return false;
        }
        $table = SBS_DB::table('sessions');
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE token_hash = %s", hash('sha256', $raw)), ARRAY_A);
        if (!$row || strtotime($row['expires_at'] . ' UTC') <= time()) {
            return false;
        }
        if (!hash_equals($row['ip_hash'], self::ip_hash())) {
            return false;
        }
        if (strtotime($row['last_seen_at'] . ' UTC') < time() - HOUR_IN_SECONDS) {
            $wpdb->update($table, array('last_seen_at' => current_time('mysql', true)), array('id' => (int) $row['id']));
        }
        return true;
    }

    public static function permission()
    {
        return self::is_authenticated();
    }

    public static function cleanup()
    {
        global $wpdb;
        $sessions = SBS_DB::table('sessions');
        $attempts = SBS_DB::table('login_attempts');
        $now = current_time('mysql', true);
        $wpdb->query($wpdb->prepare("DELETE FROM {$sessions} WHERE expires_at < %s", $now));
        $wpdb->query($wpdb->prepare("DELETE FROM {$attempts} WHERE updated_at < %s", gmdate('Y-m-d H:i:s', time() - DAY_IN_SECONDS)));
    }

    public static function revoke_all()
    {
        global $wpdb;
        $wpdb->query('DELETE FROM ' . SBS_DB::table('sessions'));
    }

    private static function attempt_key()
    {
        return hash('sha256', self::client_ip() . '|' . strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')) . '|' . wp_salt('nonce'));
    }

    private static function update_attempt_key()
    {
        return hash('sha256', self::client_ip() . '|' . strtolower((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')) . '|' . wp_salt('secure_auth'));
    }

    private static function ip_hash()
    {
        return hash('sha256', self::client_ip() . '|' . wp_salt('auth'));
    }

    private static function client_ip()
    {
        return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    }
}
