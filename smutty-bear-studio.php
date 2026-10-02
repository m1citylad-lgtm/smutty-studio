<?php
/**
 * Plugin Name: Smutty Bear Creative Studio
 * Plugin URI: https://smuttybear.com/
 * Description: A private, reference-grounded character image and merchandise design studio.
 * Version: 0.2.19
 * Requires at least: 5.8.17
 * Requires PHP: 7.4
 * Author: Smutty Bear
 * Text Domain: smutty-bear-studio
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SBS_VERSION', '0.2.19');
define('SBS_DB_VERSION', '2');
define('SBS_PLUGIN_FILE', __FILE__);
define('SBS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SBS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SBS_PLUGIN_BASENAME', plugin_basename(__FILE__));

require_once SBS_PLUGIN_DIR . 'includes/class-sbs-db.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-crypto.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-storage.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-auth.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-openai.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-replicate.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-portability.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-updater.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-rest.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-admin.php';
require_once SBS_PLUGIN_DIR . 'includes/class-sbs-plugin.php';

register_activation_hook(__FILE__, array('SBS_Plugin', 'activate'));
register_deactivation_hook(__FILE__, array('SBS_Plugin', 'deactivate'));

SBS_Plugin::instance()->boot();
