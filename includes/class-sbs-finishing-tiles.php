<?php
if(!defined('ABSPATH')){exit;}
/** Overlapping native-resolution sections; each local stage is persisted separately. */
final class SBS_Finishing_Tiles
{
    public static function plan($w,$h){$out=array();for($y=0;$y<$h;$y+=1280){for($x=0;$x<$w;$x+=1280){$left=max(0,$x-48);$top=max(0,$y-48);$cw=min(1280,$w-$x);$ch=min(1280,$h-$y);$out[]=array('x'=>$x,'y'=>$y,'width'=>$cw,'height'=>$ch,'left'=>$left,'top'=>$top,'crop_width'=>min($w-$left,$cw+$x-$left+48),'crop_height'=>min($h-$top,$ch+$y-$top+48));}}return $out;}
    public static function begin($r,$source,$scale)
    {
        if(!class_exists('Imagick')){return SBS_Finishing::error('tile_tools','Large-image upscaling needs the server image tools to preserve native detail.',503);}
        $s=getimagesize(SBS_Storage::absolute_path($source));$r['pending']['tiles']=self::plan($s[0],$s[1]);$r['pending']['tile_index']=0;$r['pending']['source_asset']=$source;$r['pending']['source_sha256']=$source['sha256'];$r['pending']['source_version']=$r['current_version'];$r['pending']['scale']=$scale;$r['pending']['estimated_provider_cost']=count($r['pending']['tiles'])*(float)get_option('sbs_replicate_cost_per_image','0.002');return self::submit($r);
    }
    public static function submit_next($r){unset($r['pending']['local_stage']);return self::submit($r);}
    private static function submit($r)
    {
        SBS_Finishing::processing_stage('prepare_section');$job=$r['pending'];$i=$job['tile_index'];$t=$job['tiles'][$i];
        try{$im=new Imagick(SBS_Storage::absolute_path($job['source_asset']));$im->cropImage($t['crop_width'],$t['crop_height'],$t['left'],$t['top']);$im->setImagePage(0,0,0,0);$im->setImageFormat('png');$a=SBS_Storage::store_bytes($im->getImagesBlob(),'upscale-section.png','image/png','finishing',0,'upscale_tile',$r['title']);$im->clear();}catch(Exception $e){SBS_Finishing::processing_exception($e);return SBS_Finishing::error('tile_crop','Could not prepare the next image section.',422);}
        if(is_wp_error($a)){return $a;}$p=SBS_Replicate::submit($a['id'],$job['scale']);if(is_wp_error($p)){return $p;}if(empty($p['id'])){return SBS_Finishing::error('tile_job','No upscale tracking reference returned.',502);}
        $r['pending']['replicate_prediction_id']=$p['id'];$r['pending']['tiles'][$i]['input']=$a;$r['status']='AI upscale processing on Replicate';$r['next_action']='Upscaling section '.($i+1).' of '.count($job['tiles']).'; original detail is preserved';return $r;
    }
    public static function advance($r,$p)
    {
        $job=$r['pending'];$i=$job['tile_index'];$t=$job['tiles'][$i];
        if(empty($t['output'])){
            $url=$p['output']??null;if(is_array($url)){$url=reset($url);}if(!is_string($url)){return SBS_Finishing::error('tile_output','Missing enlarged image section.',502);}
            SBS_Finishing::processing_stage('download_section');$bytes=SBS_Replicate::fetch_output($url);if(is_wp_error($bytes)){return SBS_Finishing::processing_result($bytes);}$s=@getimagesizefromstring($bytes);if(!$s||$s[0]!==$t['crop_width']*$job['scale']||$s[1]!==$t['crop_height']*$job['scale']){return SBS_Finishing::error('tile_shape','An enlarged section has unexpected dimensions. Source kept.',422);}
            $a=SBS_Storage::store_bytes($bytes,'upscaled-section.png','image/png','finishing',0,'upscale_section',$r['title']);if(is_wp_error($a)){return SBS_Finishing::processing_result($a);}unset($bytes);$r['pending']['tiles'][$i]['output']=$a;
        }
        $r['status']='Finishing existing upscale';
        if($i+1<count($job['tiles'])){$r['pending']['tile_index']++;$r['pending']['local_stage']='next_section';$r['next_action']='Section '.($i+1).' saved; preparing the next section';}
        else{$r['pending']['local_stage']='assemble';$r['next_action']='All enlarged sections saved; joining the existing outputs';}
        return $r;
    }
    public static function assemble($r)
    {
        SBS_Finishing::processing_stage('join_sections');$job=$r['pending'];$sz=@getimagesize(SBS_Storage::absolute_path($job['source_asset']));$scale=(int)$job['scale'];
        if(!$sz||!in_array($scale,array(2,4),true)||$sz[0]*$sz[1]*$scale*$scale>40000000){return SBS_Finishing::error('tile_size','The saved section plan has invalid dimensions. Source kept.',422);}
        $tmp=tempnam(SBS_Storage::base_dir().'/tmp','upscale-join-');if(!$tmp){return SBS_Finishing::error('tile_storage','Could not prepare private storage for joining sections.',500);}
        $out=null;$part=null;
        try{
            $out=new Imagick();$out->newImage($sz[0]*$scale,$sz[1]*$scale,new ImagickPixel('transparent'),'png');
            foreach($job['tiles'] as $t){
                $asset=$t['output']??array();$path=$asset?SBS_Storage::absolute_path($asset):'';
                if(!$path||!is_file($path)||!hash_equals($asset['sha256'],hash_file('sha256',$path))){return SBS_Finishing::error('tile_integrity','A saved image section is missing or changed. Source and provider job retained.',409);}
                $part=new Imagick($path);$part->cropImage($t['width']*$scale,$t['height']*$scale,($t['x']-$t['left'])*$scale,($t['y']-$t['top'])*$scale);$part->setImagePage(0,0,0,0);$out->compositeImage($part,Imagick::COMPOSITE_COPY,$t['x']*$scale,$t['y']*$scale);$part->clear();$part=null;
            }
            // Write directly to a private file; avoid a second full PNG string in PHP.
            $out->setImageFormat('png');$out->writeImage($tmp);$out->clear();$out=null;
            $assembled=SBS_Storage::store_file($tmp,'upscale-assembled.png','image/png','finishing',0,'upscale_assembled',$r['title']);if(is_wp_error($assembled)){return $assembled;}
            $r['pending']['local_asset']=$assembled;$r['pending']['local_stage']='candidate';$r['next_action']='Joined output saved; restoring source transparency and saving the enlarged candidate';return $r;
        }catch(Exception $e){SBS_Finishing::processing_exception($e);return SBS_Finishing::error('tile_assembly','Could not join the enlarged image sections. Saved sections and source kept.',422);}
        finally{if($part){$part->clear();}if($out){$out->clear();}@unlink($tmp);}
    }
}
