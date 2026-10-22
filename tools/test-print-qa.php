<?php
/** Real PNG conversion/package tests, using isolated storage and no provider calls. */
define('ABSPATH',__DIR__.'/');define('SBS_PLUGIN_DIR',dirname(__DIR__).'/');
class WP_Error { public $message; function __construct($code,$message,$data=null){$this->message=$message;} }
function is_wp_error($v){return $v instanceof WP_Error;}
function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}
function sanitize_textarea_field($v){return $v;}
function remove_accents($v){return $v;}
function wp_generate_uuid4(){return sprintf('%08s-0000-4000-8000-%012s',bin2hex(random_bytes(4)),bin2hex(random_bytes(6)));}
function check_qa($v,$message){if(!$v){throw new Exception($message);}}
$dir=sys_get_temp_dir().'/sbs-print-test-'.bin2hex(random_bytes(5));mkdir($dir);mkdir($dir.'/tmp');
class SBS_Storage {
    static function absolute_path($asset){return $asset['path'];}
    static function base_dir(){return $GLOBALS['dir'];}
    static function store_bytes($bytes,$name,$mime,$owner,$id,$role,$title,$meta=array()){$path=self::base_dir().'/'.bin2hex(random_bytes(4)).'-'.$name;file_put_contents($path,$bytes);return array('path'=>$path,'filename'=>$name,'mime'=>$mime,'sha256'=>hash('sha256',$bytes),'metadata_json'=>json_encode($meta));}
    static function store_file($path,$name,$mime,$owner,$id,$role,$title){return self::store_bytes(file_get_contents($path),$name,$mime,$owner,$id,$role,$title);}
}
require dirname(__DIR__).'/includes/class-sbs-print-qa.php';
require dirname(__DIR__).'/includes/class-sbs-finishing.php';
try{
    $im=imagecreatetruecolor(100,100);imagealphablending($im,false);imagesavealpha($im,true);$clear=imagecolorallocatealpha($im,0,0,0,127);imagefill($im,0,0,$clear);
    imagefilledrectangle($im,20,20,79,79,imagecolorallocatealpha($im,120,40,20,0));
    imagefilledrectangle($im,30,30,35,35,imagecolorallocatealpha($im,255,255,255,0));
    imagesetpixel($im,5,5,imagecolorallocatealpha($im,255,0,0,0));imagesetpixel($im,60,60,$clear);imagesetpixel($im,80,50,imagecolorallocatealpha($im,255,255,255,64));
    $source=$dir.'/original.png';imagepng($im,$source);imagedestroy($im);$hash=hash_file('sha256',$source);
    $sample=SBS_Print_QA::sample($source);check_qa($sample['status']==='sampled'&&count($sample['findings'])===3,'Missing detached mark, opening or pale-alpha finding');
    check_qa($sample['findings'][0]['focus']['x']>.05&&$sample['findings'][0]['focus']['x']<.06,'Detached-mark focus is not at the actual mark');
    foreach($sample['findings'] as $f){check_qa($f['severity']==='review'&&$f['method']==='sampled_alpha','Sampling incorrectly certifies a defect');}
    $options=array('width'=>1.0,'height'=>1.0,'ppi'=>300,'method'=>'print_png','print_canvas'=>false,'notes'=>'');
    $converted=SBS_Print_QA::normalize($source,$options);check_qa(!is_wp_error($converted),is_wp_error($converted)?$converted->message:'Conversion failed');
    $output=$dir.'/normalized.png';file_put_contents($output,$converted['bytes']);$meta=SBS_Print_QA::metadata($output);
    check_qa($meta['profile']==='srgb_icc'&&$meta['bit_depth']===8&&$meta['png_color_type']===6&&abs($meta['ppi_x']-300)<.01,'PNG export metadata is incorrect');
    $im=imagecreatefrompng($output);$white=imagecolorsforindex($im,imagecolorat($im,32,32));$fade=imagecolorsforindex($im,imagecolorat($im,80,50));
    check_qa($white['alpha']===0&&$white['red']===255,'Opaque white ink was removed');check_qa(abs($fade['alpha']-64)<=1,'Deliberate partial alpha was removed');imagedestroy($im);
    check_qa(hash_file('sha256',$source)===$hash,'Original bytes changed');
    $options['print_canvas']=true;$fit=SBS_Print_QA::normalize($source,$options);check_qa(!is_wp_error($fit),'Canvas conversion failed');
    check_qa(getimagesizefromstring($fit['bytes'])[0]===300&&$fit['metadata']['artwork_pixels']===array(100,100)&&$fit['metadata']['padding_pixels']===array(100,100),'Canvas enlarged, cropped or distorted the artwork');
    // Non-standard colour declarations are held instead of silently relabelled sRGB.
    $bad_gamma=substr(file_get_contents($source),0,33);$gamma=pack('N',100000);$chunk='gAMA'.$gamma;$bad_gamma.=pack('N',4).$chunk.pack('H*',hash('crc32b',$chunk)).substr(file_get_contents($source),33);file_put_contents($dir.'/gamma.png',$bad_gamma);
    check_qa(is_wp_error(SBS_Print_QA::normalize($dir.'/gamma.png',$options)),'Unverified gamma was silently assigned sRGB');
    // Selected candidates are the source for print conversion, not the lower-resolution original.
    $record_source=array('original'=>array('path'=>$source,'filename'=>'source.png','mime'=>'image/png','sha256'=>$hash),'original_qa'=>array('alpha'=>'Transparency detected (sampled)'),'title'=>'Test','versions'=>array(array('uuid'=>'selected','asset'=>array('path'=>$output,'filename'=>'normalized.png','mime'=>'image/png','sha256'=>hash_file('sha256',$output)))),'current_version'=>'selected');
    $process=new ReflectionMethod('SBS_Finishing','process');$process->setAccessible(true);$processed=$process->invoke(null,$record_source,$options);
    check_qa(!is_wp_error($processed)&&$processed['options']['source_sha256']===hash_file('sha256',$output),'Print conversion discarded the selected candidate');
    $options['width']=30;$options['height']=30;check_qa(is_wp_error(SBS_Print_QA::normalize($source,$options)),'Unsafe canvas was accepted');
    $options['width']=1;$options['height']=1;
    $asset=array('path'=>$source,'filename'=>'original.png','mime'=>'image/png','sha256'=>$hash);
    $candidate=SBS_Storage::store_bytes($fit['bytes'],'candidate.png','image/png','',0,'','',array('print_export'=>$fit['metadata']));
    $qa=SBS_Finishing::inspect($candidate,$options);
    $record=array('uuid'=>'workspace-test','title'=>'Test artwork','original'=>$asset,'original_qa'=>SBS_Finishing::inspect($asset,$options),'versions'=>array(array('uuid'=>'v1','number'=>1,'asset'=>$candidate,'qa'=>$qa,'options'=>$options,'comparison'=>array('geometry'=>array('status'=>'review')))),'current_version'=>'v1','approval'=>array('version'=>'v1','sha256'=>$candidate['sha256'],'at'=>'test','checks'=>array('identity'=>true,'lettering'=>true,'texture'=>true,'garments'=>true,'warnings'=>true,'colour'=>true)));
    $manifest=SBS_Print_QA::manifest($record);check_qa($manifest['overall']==='PASS'&&$manifest['production_approved']===false,'Validated canvas or local approval incorrectly classified');
    $plan=SBS_Print_QA::production_rechecks($manifest,$candidate['sha256'],$manifest['target']);check_qa(!in_array('pixels',$plan['recheck'],true)&&in_array('brand_assets',$plan['recheck'],true),'Unchanged finishing unnecessarily repeated or branding not checked');
    $changed=SBS_Print_QA::production_rechecks($manifest,str_repeat('0',64),$manifest['target']);check_qa(in_array('pixels',$changed['recheck'],true),'Changed pixels reused old QA');
    $new_target=$manifest['target'];$new_target['width_inches']=2;$changed=SBS_Print_QA::production_rechecks($manifest,$candidate['sha256'],$new_target);check_qa(in_array('ppi',$changed['recheck'],true)&&!in_array('pixels',$changed['recheck'],true),'Changed print target did not selectively recheck');
    $package=new ReflectionMethod('SBS_Finishing','package');$package->setAccessible(true);$archive=$package->invoke(null,$record,'Print test');check_qa(!is_wp_error($archive),'Package build failed');
    $zip=new ZipArchive();$zip->open($archive['path']);$packed=json_decode($zip->getFromName('finishing-qa.json'),true);
    check_qa($packed['candidate_sha256']===$candidate['sha256']&&hash('sha256',$zip->getFromName('original/original.png'))===$hash,'Packaged manifest or original checksum mismatch');
    check_qa(strpos($zip->getFromName('checksums.sha256'),$hash)!==false&&hash('sha256',$zip->getFromName('candidate/candidate.png'))===$candidate['sha256'],'Candidate/checksum manifest mismatch');$zip->close();
    // A stale approval cannot authorize packaging of changed candidate bytes.
    file_put_contents($candidate['path'],'tampered');check_qa(is_wp_error($package->invoke(null,$record)),'Tampered candidate was packaged');
    echo "Print QA: ICC/RGBA/PPI, alpha preservation, focused findings, no-stretch canvas, selective rechecks and ZIP integrity passed.\n";
}finally{foreach(glob($dir.'/*') as $file){if(is_file($file)){unlink($file);}}foreach(glob($dir.'/tmp/*') as $file){unlink($file);}rmdir($dir.'/tmp');rmdir($dir);}
