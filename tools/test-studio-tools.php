<?php
define('ABSPATH',__DIR__.'/');
require dirname(__DIR__).'/includes/class-sbs-studio-tools.php';
function check($v,$m){if(!$v){throw new Exception($m);}}
foreach(array(8,16) as $depth){
 $source=new Imagick();$source->newImage(24,18,new ImagickPixel('rgba(80,110,160,.65)'),'png');$source->setImageDepth($depth);$source->setImageResolution(300,300);$source->setImageUnits(Imagick::RESOLUTION_PIXELSPERINCH);
 $pixels=$source->exportImagePixels(0,0,24,18,'RGBA',Imagick::PIXEL_DOUBLE);foreach($pixels as $i=>&$value){if($i%4!==3){$value=($i%251)/255;}else{$value=($i%13)/13;}}unset($value);$source->importImagePixels(0,0,24,18,'RGBA',Imagick::PIXEL_DOUBLE,$pixels);$source->setImageFormat('png');$source->setOption('png:color-type','6');$orig=$source->getImageBlob();$source->readImageBlob($orig);
 $mask=new Imagick();$mask->newImage(24,18,'transparent','png');$draw=new ImagickDraw();$draw->setFillColor('white');$draw->rectangle(4,5,8,9);$draw->rectangle(15,11,17,13);$mask->drawImage($draw);
 $gen=new Imagick();$gen->newImage(24,18,new ImagickPixel('rgba(240,25,50,.3)'),'png');$bytes=SBS_Studio_Tools::protected_patch($source,$mask,$gen,array('x'=>0,'y'=>0,'w'=>24,'h'=>18));$result=new Imagick();$result->readImageBlob($bytes);
 $old=$source->exportImagePixels(0,0,24,18,'RGBA',Imagick::PIXEL_DOUBLE);$new=$result->exportImagePixels(0,0,24,18,'RGBA',Imagick::PIXEL_DOUBLE);$m=$mask->exportImagePixels(0,0,24,18,'A',Imagick::PIXEL_DOUBLE);$changes=0;foreach($m as $i=>$alpha){for($k=0;$k<4;$k++){if(!$alpha){check(abs($old[$i*4+$k]-$new[$i*4+$k])<1/65535/2,'Outside selection changed at '.$depth.' bits');}elseif($old[$i*4+$k]!==$new[$i*4+$k]){$changes++;}}}check($changes>0,'No actual repair applied');check($result->getImageDepth()===$depth,'Depth was lost');$r=$result->getImageResolution();check(abs($r['x']-300)<.1,'PPI lost');check($source->getImageBlob()===$orig,'Source modified');
 $bad=new Imagick();$bad->newImage(10,10,'white','png');$failed=false;try{SBS_Studio_Tools::protected_patch($source,$bad,$gen,array('x'=>0,'y'=>0,'w'=>24,'h'=>18));}catch(Throwable $e){$failed=true;}check($failed,'Wrong-size selection accepted');
 $failed=false;try{SBS_Studio_Tools::protected_patch($source,$mask,$gen,array('x'=>0,'y'=>0,'w'=>2,'h'=>2));}catch(Throwable $e){$failed=true;}check($failed,'Selection outside context accepted');
}
echo "Protected repairs: 8/16-bit RGBA, disjoint selection, outside pixel equality, PPI, immutable originals and invalid mask/context checks passed.\n";
