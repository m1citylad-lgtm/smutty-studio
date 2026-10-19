<?php
/** Isolated updater rollback regression tests. Requires PHP ZipArchive; no live site or data. */
error_reporting(E_ALL);
$root = sys_get_temp_dir() . '/sbs-updater-test-' . bin2hex(random_bytes(6));
define('ABSPATH', $root . '/');
define('WP_CONTENT_DIR', $root . '/content');
define('WP_PLUGIN_DIR', $root . '/plugins');
define('SBS_PLUGIN_DIR', $root . '/source/smutty-bear-studio/');
define('SBS_PLUGIN_BASENAME', 'smutty-bear-studio/smutty-bear-studio.php');
define('SBS_VERSION', '0.2.49');
define('MB_IN_BYTES', 1048576);
define('KB_IN_BYTES', 1024);
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
define('ARRAY_A', 'ARRAY_A');
$GLOBALS['wp_version'] = '6.8';
$GLOBALS['options'] = array();
$GLOBALS['fail_next_install'] = false;

class WP_Error {
    private $code; private $message;
    function __construct($code, $message) { $this->code = $code; $this->message = $message; }
    function get_error_code() { return $this->code; }
    function get_error_message() { return $this->message; }
}
function is_wp_error($value) { return $value instanceof WP_Error; }
function check_test($value, $message) { if (!$value) { throw new Exception($message); } }
function get_option($key, $default = '') { return $GLOBALS['options'][$key] ?? $default; }
function update_option($key, $value) { $GLOBALS['options'][$key] = $value; return true; }
function delete_option($key) { unset($GLOBALS['options'][$key]); }
function add_option($key, $value) { if (isset($GLOBALS['options'][$key])) return false; $GLOBALS['options'][$key] = $value; return true; }
function wp_tempnam($name = '') { return tempnam(sys_get_temp_dir(), 'sbs-' . preg_replace('/[^a-z0-9]/i', '', $name)); }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_mkdir_p($path) { return is_dir($path) || mkdir($path, 0777, true); }
function untrailingslashit($path) { return rtrim($path, '/\\'); }
function is_plugin_active($plugin) { return true; }
function activate_plugin($plugin) { return true; }
function delete_site_transient($key) {}
function delete_transient($key) {}
function get_plugin_data($path) {
    $source = file_get_contents($path);
    preg_match('/^\s*\* Version:\s*(.+)$/m', $source, $match);
    return array('Version' => trim($match[1] ?? ''));
}
class SBS_Storage {
    static function ensure_directories() { return wp_mkdir_p(self::base_dir() . '/updates/backups'); }
    static function base_dir() { return WP_CONTENT_DIR . '/smutty-bear-private'; }
}

wp_mkdir_p(ABSPATH . 'wp-admin/includes');
wp_mkdir_p(SBS_PLUGIN_DIR);
wp_mkdir_p(WP_PLUGIN_DIR . '/smutty-bear-studio');
wp_mkdir_p(WP_CONTENT_DIR);
file_put_contents(SBS_PLUGIN_DIR . 'smutty-bear-studio.php', "<?php\n/**\n * Version: 0.2.49\n */\n");
file_put_contents(SBS_PLUGIN_DIR . 'sample.php', "<?php // test\n");
file_put_contents(WP_PLUGIN_DIR . '/smutty-bear-studio/smutty-bear-studio.php', file_get_contents(SBS_PLUGIN_DIR . 'smutty-bear-studio.php'));
file_put_contents(ABSPATH . 'wp-admin/includes/class-wp-upgrader.php', <<<'STUB'
<?php
class Automatic_Upgrader_Skin {}
class Plugin_Upgrader {
    function __construct($skin) {}
    function install($package, $args = array()) {
        if ($GLOBALS['fail_next_install']) { $GLOBALS['fail_next_install'] = false; return false; }
        $zip = new ZipArchive();
        if ($zip->open($package) !== true || !$zip->extractTo(WP_PLUGIN_DIR)) return false;
        $zip->close();
        return true;
    }
}
STUB
);
require dirname(__DIR__) . '/includes/class-sbs-updater.php';

function make_package($version, $with_manifest = true) {
    $path = wp_tempnam('release.zip');
    $zip = new ZipArchive();
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $main = "<?php\n/**\n * Version: {$version}\n */\n";
    $zip->addFromString('smutty-bear-studio/smutty-bear-studio.php', $main);
    $zip->addFromString('smutty-bear-studio/sample.php', "<?php // test\n");
    if ($with_manifest) {
        $manifest = array('slug' => 'smutty-bear-studio', 'version' => $version, 'files' => array(
            'smutty-bear-studio.php' => hash('sha256', $main), 'sample.php' => hash('sha256', "<?php // test\n"),
        ));
        $zip->addFromString('smutty-bear-studio/release.json', json_encode($manifest));
    }
    $zip->close();
    return $path;
}
function current_installed_version() { return get_plugin_data(WP_PLUGIN_DIR . '/smutty-bear-studio/smutty-bear-studio.php')['Version']; }

try {
    // New internal backups include a valid manifest accepted by the normal verifier.
    $backup = SBS_Updater::create_backup();
    check_test(!is_wp_error($backup), 'Backup creation failed.');
    $zip = new ZipArchive(); $zip->open($backup);
    check_test($zip->statName('smutty-bear-studio/release.json') !== false, 'New backup has no release manifest.');
    $zip->close();
    check_test(!is_wp_error(SBS_Updater::verify_package($backup, true)), 'New backup did not pass package verification.');

    // Failed installation restores the pre-install plugin files.
    $update = make_package('0.2.50');
    $GLOBALS['fail_next_install'] = true;
    $failed = SBS_Updater::install_uploaded($update, false);
    check_test(is_wp_error($failed) && $failed->get_error_code() === 'update_failed', 'The simulated failed update did not report failure.');
    check_test(current_installed_version() === '0.2.49', 'The previous plugin was not restored after failed installation.');

    // Legacy 0.2.48 file-only backup is normalized and restored.
    $legacy = make_package('0.2.48', false);
    $legacy_name = 'smutty-bear-studio-0.2.48-20261019-184334.zip';
    $legacy_path = SBS_Storage::base_dir() . '/updates/backups/' . $legacy_name;
    copy($legacy, $legacy_path);
    $rolled = SBS_Updater::rollback($legacy_name);
    check_test(!is_wp_error($rolled) && $rolled['version'] === '0.2.48', 'Legacy backup rollback failed.');
    check_test(current_installed_version() === '0.2.48', 'Rollback did not install the requested version.');

    // Invalid paths are rejected before installation.
    $bad_path = SBS_Storage::base_dir() . '/updates/backups/smutty-bear-studio-0.2.48-20261019-181455.zip';
    $bad = new ZipArchive(); $bad->open($bad_path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $bad->addFromString('smutty-bear-studio/../outside.php', 'bad'); $bad->close();
    $invalid = SBS_Updater::rollback(basename($bad_path));
    check_test(is_wp_error($invalid), 'Unsafe backup was not rejected.');
    echo "Updater rollback regression tests passed.\n";
} finally {
    $remove = function ($path) use (&$remove) {
        if (is_dir($path)) { foreach (scandir($path) as $item) { if ($item !== '.' && $item !== '..') $remove($path . '/' . $item); } rmdir($path); }
        elseif (file_exists($path)) unlink($path);
    };
    $remove($root);
}
