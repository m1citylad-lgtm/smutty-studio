<?php
if(!defined('ABSPATH')){exit;}
final class SBS_Finishing_Image
{
    public static function prepare($asset,$box,$title)
    {
        if(!class_exists('Imagick')){return SBS_Finishing::error('repair_tools','The server needs alpha-preserving image tools for local AI repairs.',503);}
        foreach(array('x','y','width','height') as $k){if(!isset($box[$k])||!is_numeric($box[$k])||!is_finite((float)$box[$k])){return SBS_Finishing::error('repair_area','This issue needs a clearer location.');}}
        $size=getimagesize(SBS_Storage::absolute_path($asset));$x=max(0,min($size[0]-1,(int)floor($box['x']*$size[0])));$y=max(0,min($size[1]-1,(int)floor($box['y']*$size[1])));$w=max(1,min($size[0]-$x,(int)ceil($box['width']*$size[0])));$h=max(1,min($size[1]-$y,(int)ceil($box['height']*$size[1])));
        if($size[0]*$size[1]>40000000||$w*$h>2000000){return SBS_Finishing::error('repair_size','This repair area is too large. Source kept.',413);}
        $pad=max(24,(int)(max($w,$h)*.2));$left=max(0,$x-$pad);$top=max(0,$y-$pad);$cw=min($size[0]-$left,$w+$x-$left+$pad);$ch=min($size[1]-$top,$h+$y-$top+$pad);
        try{
            $im=new Imagick(SBS_Storage::absolute_path($asset));$im->cropImage($cw,$ch,$left,$top);$im->setImagePage(0,0,0,0);$im->setImageFormat('png');$im->setImageDepth(8);$im->setOption('png:color-type','6');$crop=SBS_Storage::store_bytes($im->getImagesBlob(),'repair-source.png','image/png','finishing',0,'repair_source',$title);$im->clear();if(is_wp_error($crop)){return $crop;}
            $mask=new Imagick();$mask->newImage($cw,$ch,new ImagickPixel('white'),'png');$mask->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);$hole=new Imagick();$hole->newImage($w,$h,new ImagickPixel('transparent'),'png');$mask->compositeImage($hole,Imagick::COMPOSITE_COPY,$x-$left,$y-$top);$hole->clear();$mask_asset=SBS_Storage::store_bytes($mask->getImagesBlob(),'repair-mask.png','image/png','finishing',0,'repair_mask',$title);$mask->clear();if(is_wp_error($mask_asset)){return $mask_asset;}
            return array('crop'=>$crop,'mask'=>$mask_asset,'bounds'=>array('x'=>$left,'y'=>$top,'width'=>$cw,'height'=>$ch,'edit_x'=>$x,'edit_y'=>$y,'edit_width'=>$w,'edit_height'=>$h));
        }catch(Exception $e){return SBS_Finishing::error('repair_prepare','The local repair could not be prepared.',422);}
    }
    public static function compose($source_path,$bytes,$b)
    {
        if(!class_exists('Imagick')){return SBS_Finishing::error('repair_tools','Alpha-preserving repair tools are unavailable.',503);}
        try{
            $size=@getimagesizefromstring($bytes);if(!$size||$size[0]*$size[1]>16000000){return SBS_Finishing::error('repair_output','Unexpected repair image.',422);}
            $source=new Imagick($source_path);$patch=new Imagick();$patch->readImageBlob($bytes);$patch->resizeImage($b['width'],$b['height'],Imagick::FILTER_LANCZOS,1);
            $context=clone $source;$context->cropImage($b['width'],$b['height'],$b['x'],$b['y']);$a=$context->getImageChannelStatistics()[Imagick::CHANNEL_ALPHA]??array();$n=$patch->getImageChannelStatistics()[Imagick::CHANNEL_ALPHA]??array();$context->clear();
            if(isset($a['minima'],$a['maxima'],$n['minima'],$n['maxima'])&&$a['minima']<$a['maxima']&&$n['minima']===$n['maxima']){return SBS_Finishing::error('repair_alpha','The repair flattened transparency. Preview rejected; source kept.',422);}
            $patch->cropImage($b['edit_width'],$b['edit_height'],$b['edit_x']-$b['x'],$b['edit_y']-$b['y']);$patch->setImagePage(0,0,0,0);$old=clone $source;$old->cropImage($b['edit_width'],$b['edit_height'],$b['edit_x'],$b['edit_y']);$old->setImagePage(0,0,0,0);
            $rows=$old->getPixelIterator();$new=$patch->getPixelIterator();foreach($rows as $y=>$row){$new->setIteratorRow($y);$nr=$new->getCurrentIteratorRow();foreach($row as $x=>$pixel){$alpha=$pixel->getColorValue(Imagick::COLOR_ALPHA);if($alpha>0&&$alpha<1){$nr[$x]->setColorValue(Imagick::COLOR_ALPHA,$alpha);}}$new->syncIterator();}
            $source->compositeImage($patch,Imagick::COMPOSITE_COPY,$b['edit_x'],$b['edit_y']);$source->setImageFormat('png');$source->setImageDepth(8);$source->setOption('png:color-type','6');$out=$source->getImagesBlob();$source->clear();$old->clear();$patch->clear();return $out;
        }catch(Exception $e){return SBS_Finishing::error('repair_compose','Could not compose the repair. Source kept.',422);}
    }
    public static function upscale_alpha($source_path,$bytes)
    {
        if(!class_exists('Imagick')){return SBS_Finishing::error('upscale_alpha_tools','Transparent upscaling needs the server image tools.',503);}
        try{$source=new Imagick($source_path);$out=new Imagick();$out->readImageBlob($bytes);$source->setImageAlphaChannel(Imagick::ALPHACHANNEL_EXTRACT);$source->resizeImage($out->getImageWidth(),$out->getImageHeight(),Imagick::FILTER_LANCZOS,1);$out->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);$out->compositeImage($source,Imagick::COMPOSITE_COPYOPACITY,0,0);$out->setImageFormat('png');$out->setImageDepth(8);$out->setOption('png:color-type','6');$bytes=$out->getImagesBlob();$source->clear();$out->clear();return $bytes;}catch(Exception $e){SBS_Finishing::processing_exception($e);return SBS_Finishing::error('upscale_alpha','Could not preserve enlarged transparency. Source kept.',422);}
    }
}
