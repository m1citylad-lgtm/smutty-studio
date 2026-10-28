<?php
define('ABSPATH', __DIR__);
require_once __DIR__ . '/../includes/class-sbs-finishing.php';

$method = new ReflectionMethod('SBS_Finishing', 'pending_job_kind');
$method->setAccessible(true);
$cases = array(
    array('Queued', array('pending' => array('method' => 'inspect')), 'queued'),
    array('Awaiting Review', array('pending' => null), 'none'),
    array('Finishing Approved', array('pending' => array()), 'none'),
    array('Failed', array('pending' => array('method' => 'resize')), 'queued'),
    array('Interrupted local processing', array('pending' => array('method' => 'print_png')), 'queued'),
    array('Interrupted Replicate processing', array('pending' => array('method' => 'upscale', 'replicate_prediction_id' => 'pred_123')), 'remote'),
    array('Unverified pending state', array('pending' => 'unknown'), 'invalid'),
    array('Other valid processing status', array('pending' => null), 'none'),
);

foreach ($cases as $case) {
    $actual = $method->invoke(null, $case[1]);
    if ($actual !== $case[2]) {
        fwrite(STDERR, 'FAIL: ' . $case[0] . ' classified as ' . $actual . ', expected ' . $case[2] . "\n");
        exit(1);
    }
}

echo "PASS: queued, reviewed, approved, failed and interrupted job states are distinguished independently of the display status\n";
