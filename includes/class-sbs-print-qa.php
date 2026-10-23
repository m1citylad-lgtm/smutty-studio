<?php
if (!defined('ABSPATH')) { exit; }

/** Digital print checks only. Never repairs alpha, redraws artwork or grants production approval. */
final class SBS_Print_QA
{
    const SCHEMA = 1;
    public static function profile()
    {
        return file_get_contents(SBS_PLUGIN_DIR.'assets/color/sRGB.icc');
    }
    private static function valid_profile($profile)
    {
        return is_string($profile) && strlen($profile)>=128 && substr($profile,36,4)==='acsp'
            && unpack('N',substr($profile,0,4))[1]===strlen($profile);
    }
    public static function metadata($path)
    {
        $size=@getimagesize($path);
        $out=array('mime'=>$size['mime']??null,'width'=>$size[0]??null,'height'=>$size[1]??null,
            'bit_depth'=>null,'png_color_type'=>null,'ppi_x'=>null,'ppi_y'=>null,
            'profile'=>'untagged','profile_sha256'=>null,'gamma'=>null,'chromaticity'=>false);
        $f=@fopen($path,'rb');if(!$f){return $out;}
        if(fread($f,8)!=="\x89PNG\r\n\x1a\n"){
            fclose($f);
            if(class_exists('Imagick')){try{$image=new Imagick();$image->pingImage($path);$profiles=$image->getImageProfiles('icc',true);if(!empty($profiles['icc'])){$icc=$profiles['icc'];$out['profile']=self::valid_profile($icc)?(hash_equals(hash('sha256',self::profile()),hash('sha256',$icc))?'srgb_icc':'embedded_icc_unverified'):'invalid_icc';$out['profile_sha256']=hash('sha256',$icc);}$image->clear();}catch(Throwable $error){$out['profile']='unverified';}}
            return $out;
        }
        while(!feof($f)){
            $head=fread($f,8);if(strlen($head)!==8){break;}
            $n=unpack('N',substr($head,0,4))[1];$type=substr($head,4,4);
            if($n>100000000){break;}
            if(!in_array($type,array('IHDR','pHYs','iCCP','sRGB','gAMA','cHRM'),true)){fseek($f,$n+4,SEEK_CUR);if($type==='IEND'){break;}continue;}
            if($n>2000000){$out['profile']='invalid_or_oversized';break;}
            $data=fread($f,$n);$crc=fread($f,4);
            if(strlen($data)!==$n||strlen($crc)!==4||bin2hex($crc)!==hash('crc32b',$type.$data)){$out['profile']='invalid_metadata';break;}
            if($type==='IHDR'&&$n===13){$out['bit_depth']=ord($data[8]);$out['png_color_type']=ord($data[9]);}
            if($type==='pHYs'&&$n===9&&ord($data[8])===1){$p=unpack('Nx/Ny',substr($data,0,8));$out['ppi_x']=round($p['x']*.0254,2);$out['ppi_y']=round($p['y']*.0254,2);}
            if($type==='gAMA'&&$n===4){$out['gamma']=unpack('N',$data)[1]/100000;}
            if($type==='cHRM'){$out['chromaticity']=true;}
            if($type==='sRGB'&&$out['profile']==='untagged'){$out['profile']='srgb_chunk';}
            if($type==='iCCP'){
                $zero=strpos($data,"\0");$profile=$zero!==false&&isset($data[$zero+1])&&ord($data[$zero+1])===0?@gzuncompress(substr($data,$zero+2),2000000):false;
                $out['profile']=self::valid_profile($profile)?(hash_equals(hash('sha256',self::profile()),hash('sha256',$profile))?'srgb_icc':'embedded_icc_unverified'):'invalid_icc';
                if(is_string($profile)){$out['profile_sha256']=hash('sha256',$profile);}
            }
        }
        fclose($f);return $out;
    }
    private static function chunk($type,$data)
    {
        return pack('N',strlen($data)).$type.$data.pack('H*',hash('crc32b',$type.$data));
    }
    public static function tag_png($bytes)
    {
        $out=substr($bytes,0,8);$pos=8;$length=strlen($bytes);
        while($pos+12<=$length){
            $n=unpack('N',substr($bytes,$pos,4))[1];$type=substr($bytes,$pos+4,4);
            if($n>$length-$pos-12){return false;}
            if(!in_array($type,array('iCCP','sRGB','gAMA','cHRM','pHYs'),true)){$out.=substr($bytes,$pos,$n+12);}
            if($type==='IHDR'){$out.=self::chunk('iCCP',"sRGB\0\0".gzcompress(self::profile(),9));$out.=self::chunk('pHYs',pack('NNc',11811,11811,1));}
            $pos+=$n+12;
        }
        return $out;
    }
    public static function gd_memory_available($pixels)
    {
        $limit=ini_get('memory_limit');if($limit==='-1'){return true;}
        $n=(int)$limit;$unit=strtolower(substr($limit,-1));if($unit==='g'){$n*=1073741824;}elseif($unit==='m'){$n*=1048576;}elseif($unit==='k'){$n*=1024;}
        return memory_get_usage(true)+$pixels*8+33554432<$n;
    }
    /** Explicit local conversion into a NEW PNG; never increases artwork pixel dimensions. */
    public static function normalize($path,$options)
    {
        $meta=self::metadata($path);$w=(int)$meta['width'];$h=(int)$meta['height'];
        if(!$w||!$h||$w*$h>40000000){return new WP_Error('print_dimensions','Image exceeds the safe processing limit. Original unchanged.');}
        $canvas=!empty($options['print_canvas']);$tw=$canvas?(int)round($options['width']*300):$w;$th=$canvas?(int)round($options['height']*300):$h;
        if($tw*$th>40000000){return new WP_Error('print_canvas','Choose a target canvas below 40 million pixels. Original unchanged.');}
        $ratio=$canvas?min(1,$tw/$w,$th/$h):1;$nw=max(1,(int)round($w*$ratio));$nh=max(1,(int)round($h*$ratio));$assumption='Existing colour profile converted to sRGB';
        try{
            if($meta['profile']==='untagged'&&(($meta['gamma']!==null&&abs($meta['gamma']-.45455)>.0001)||$meta['chromaticity'])){throw new Exception('Untagged source has colour/gamma declarations that need an ICC-managed conversion.');}
            if(class_exists('Imagick')){
                $im=new Imagick($path);$im->setIteratorIndex(0);$profiles=$im->getImageProfiles('icc',true);
                if(!empty($profiles['icc'])){
                    if(!self::valid_profile($profiles['icc'])){throw new Exception('The source ICC profile is invalid.');}
                    $im->profileImage('icc',self::profile());
                }else{
                    if($im->getImageColorspace()===Imagick::COLORSPACE_CMYK){throw new Exception('CMYK input needs a valid embedded ICC profile.');}
                    if(strpos($meta['profile'],'invalid')===0){throw new Exception('The source colour metadata is invalid.');}
                    $assumption=$meta['profile']==='srgb_chunk'?'Source declares sRGB':'Untagged source assumed sRGB — confirm colours manually';
                    $im->setImageColorspace(Imagick::COLORSPACE_SRGB);$im->profileImage('icc',self::profile());
                }
                if($nw!==$w||$nh!==$h){$im->resizeImage($nw,$nh,Imagick::FILTER_LANCZOS,1);}
                if($canvas){$base=new Imagick();$base->newImage($tw,$th,new ImagickPixel('transparent'));$base->setImageColorspace(Imagick::COLORSPACE_SRGB);$base->compositeImage($im,Imagick::COMPOSITE_OVER,(int)floor(($tw-$nw)/2),(int)floor(($th-$nh)/2));$im->clear();$im=$base;}
                $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_ACTIVATE);$im->setImageDepth(8);$im->setImageFormat('png32');$im->setOption('png:color-type','6');$im->setOption('png:bit-depth','8');$bytes=$im->getImageBlob();$im->clear();
            }elseif(function_exists('imagecreatefromstring')){
                if(!in_array($meta['profile'],array('untagged','srgb_chunk','srgb_icc'),true)||$meta['mime']!=='image/png'){throw new Exception('This server needs Imagick to safely convert this colour profile or non-PNG input.');}
                if(!self::gd_memory_available($w*$h+$tw*$th)){throw new Exception('Not enough server memory for this print canvas. Choose a smaller target.');}
                $source=@imagecreatefromstring(file_get_contents($path));if(!$source){throw new Exception('The source could not be decoded.');}
                $out=imagecreatetruecolor($tw,$th);imagealphablending($out,false);imagesavealpha($out,true);imagefill($out,0,0,imagecolorallocatealpha($out,0,0,0,127));
                imagecopyresampled($out,$source,(int)floor(($tw-$nw)/2),(int)floor(($th-$nh)/2),0,0,$nw,$nh,$w,$h);ob_start();imagepng($out);$bytes=ob_get_clean();imagedestroy($out);imagedestroy($source);
                $assumption=$meta['profile']==='untagged'?'Untagged source assumed sRGB — confirm colours manually':'Source declares sRGB';
            }else{throw new Exception('This server has no compatible local image editor.');}
        }catch(Throwable $error){return new WP_Error('print_conversion',$error->getMessage().' No candidate was saved; original unchanged.');}
        $bytes=self::tag_png($bytes);
        if(!$bytes||ord($bytes[24])!==8||ord($bytes[25])!==6){return new WP_Error('print_format','The editor did not produce 8-bit RGBA PNG. No candidate saved.');}
        return array('bytes'=>$bytes,'metadata'=>array('colour_handling'=>$assumption,'profile_sha256'=>hash('sha256',self::profile()),'ppi'=>300,'canvas'=>$canvas,'artwork_scale'=>$ratio,'source_pixels'=>array($w,$h),'artwork_pixels'=>array($nw,$nh),'padding_pixels'=>array((int)floor(($tw-$nw)/2),(int)floor(($th-$nh)/2))));
    }
    /** Bounded nearest-point sampling: findings are review prompts, never defect verdicts. */
    public static function sample($path)
    {
        $size=@getimagesize($path);$none=array('status'=>'not_run','findings'=>array(),'limitation'=>'Pixel sampling unavailable; inspect alpha, holes and fringes manually.');
        if(!$size||!function_exists('imagecreatefromstring')||!self::gd_memory_available($size[0]*$size[1])){return $none;}
        $im=@imagecreatefromstring(file_get_contents($path));if(!$im){return $none;}
        $step=max(1,(int)ceil(max($size[0],$size[1])/512));$gw=(int)ceil($size[0]/$step);$gh=(int)ceil($size[1]/$step);$mask='';$clear=0;$partial=0;$opaque=0;$pale=null;
        for($y=0;$y<$size[1];$y+=$step){for($x=0;$x<$size[0];$x+=$step){
            $c=imagecolorsforindex($im,imagecolorat($im,$x,$y));$a=$c['alpha'];$mask.=$a<120?'1':'0';
            if($a===127){$clear++;}elseif($a>0){$partial++;if(!$pale&&$a>8&&$a<120&&min($c['red'],$c['green'],$c['blue'])>235){foreach(array(array($x-$step,$y),array($x+$step,$y),array($x,$y-$step),array($x,$y+$step)) as $neighbor){if($neighbor[0]>=0&&$neighbor[0]<$size[0]&&$neighbor[1]>=0&&$neighbor[1]<$size[1]){$near=imagecolorsforindex($im,imagecolorat($im,$neighbor[0],$neighbor[1]));if($near['alpha']>=120){$pale=array('x'=>$x/$size[0],'y'=>$y/$size[1]);break;}}}}}else{$opaque++;}
        }}imagedestroy($im);
        $findings=array();$parts=self::components($mask,$gw,$gh,'1');usort($parts,function($a,$b){return $b['area']-$a['area'];});
        if(count($parts)>1&&$parts[0]['area']>100){foreach(array_slice($parts,1) as $part){if($part['area']<=3){$findings[]=array('severity'=>'review','area'=>'Detached small mark','issue'=>'A sampled small mark is separate from the main artwork; it may be deliberate distress.','action'=>'Confirm whether to retain it.','focus'=>array('x'=>($part['x']+.5)*$step/$size[0],'y'=>($part['y']+.5)*$step/$size[1]));break;}}}
        foreach(self::components($mask,$gw,$gh,'0') as $part){if(!$part['boundary']&&$part['area']<=2){$findings[]=array('severity'=>'review','area'=>'Small transparent opening','issue'=>'A sampled enclosed transparent opening may be a counter, halftone or accidental hole.','action'=>'Check against the original; retain intentional openings.','focus'=>array('x'=>($part['x']+.5)*$step/$size[0],'y'=>($part['y']+.5)*$step/$size[1]));break;}}
        if($pale&&$clear){$findings[]=array('severity'=>'review','area'=>'Pale semi-transparent edge','issue'=>'Pale partial-alpha pixels could show a fringe on dark garments; this may be intentional.','action'=>'Inspect on black/navy; keep deliberate fades and opaque white ink.','focus'=>$pale);}
        foreach($findings as &$f){$f['focus']['x']=min(1,$f['focus']['x']);$f['focus']['y']=min(1,$f['focus']['y']);$f['method']='sampled_alpha';}unset($f);
        return array('status'=>'sampled','grid_step'=>$step,'clear_samples'=>$clear,'partial_samples'=>$partial,'opaque_samples'=>$opaque,'findings'=>$findings,'limitation'=>'Nearest-point alpha samples can miss fine defects. Findings may be intentional; no pixels were removed.');
    }
    private static function components($mask,$w,$h,$value)
    {
        $seen=str_repeat('0',strlen($mask));$parts=array();
        for($i=0,$n=strlen($mask);$i<$n;$i++){
            if($seen[$i]==='1'||$mask[$i]!==$value){continue;}
            $queue=new SplQueue();$queue->enqueue($i);$seen[$i]='1';$part=array('area'=>0,'x'=>$i%$w,'y'=>(int)floor($i/$w),'boundary'=>false);
            while(!$queue->isEmpty()){$p=$queue->dequeue();$x=$p%$w;$y=(int)floor($p/$w);$part['area']++;if(!$x||!$y||$x===$w-1||$y===$h-1){$part['boundary']=true;}
                foreach(array($x>0?$p-1:-1,$x<$w-1?$p+1:-1,$y>0?$p-$w:-1,$y<$h-1?$p+$w:-1) as $next){if($next>=0&&$seen[$next]==='0'&&$mask[$next]===$value){$seen[$next]='1';$queue->enqueue($next);}}
            }
            // Keep bounded storage even on heavily distressed images.
            if(count($parts)<10000){$parts[]=$part;}
        }
        return $parts;
    }
    public static function manifest($record)
    {
        $v=SBS_Finishing::current($record);if(!$v){return null;}$q=$v['qa'];$m=$q['export_metadata']??array();$o=$v['options'];
        $format=($m['mime']??'')==='image/png'&&($m['bit_depth']??0)===8&&($m['png_color_type']??0)===6&&($m['profile']??'')==='srgb_icc'&&abs(($m['ppi_x']??0)-300)<1&&abs(($m['ppi_y']??0)-300)<1;
        $approved=!empty($record['approval'])&&$record['approval']['version']===$v['uuid']&&hash_equals($record['approval']['sha256'],$v['asset']['sha256']);
        $fit=$q['print_export']??array();$safe_fit=!empty($o['print_canvas'])&&!empty($fit['canvas'])&&isset($fit['source_pixels'][1],$fit['artwork_pixels'][1],$fit['artwork_scale'])&&$fit['artwork_scale']>0&&$fit['artwork_scale']<=1&&abs($fit['artwork_pixels'][0]-$fit['source_pixels'][0]*$fit['artwork_scale'])<=1&&abs($fit['artwork_pixels'][1]-$fit['source_pixels'][1]*$fit['artwork_scale'])<=1;
        foreach(array('identity','lettering','texture','garments','warnings','colour') as $check){if(empty($record['approval']['checks'][$check])){$approved=false;}}
        $checks=array('export_format'=>$format?'PASS':'HOLD','print_resolution'=>($q['effective_ppi']??0)>=299.9?'PASS':'HOLD','proportions'=>($v['comparison']['geometry']['status']??'')==='proportional'?'PASS':($safe_fit?'PASS':'HOLD'),'alpha_and_edges'=>($q['pixel_review']['status']??'')==='sampled'&&!empty($q['pixel_review']['clear_samples'])&&$approved?'PASS':'REVIEW','human_fidelity'=>$approved?'PASS':'REVIEW');
        if(!empty($v['ai_review'])&&!$approved&&(($v['ai_review']['overall']??'')!=='clear'||!empty($v['ai_review']['findings']))){$checks['ai_advisory']='REVIEW';}
        $overall=in_array('HOLD',$checks,true)?'HOLD':(in_array('REVIEW',$checks,true)?'REVIEW':'PASS');
        return array('schema'=>self::SCHEMA,'workspace'=>$record['uuid'],'version'=>$v['uuid'],'source_sha256'=>$record['original']['sha256'],'candidate_sha256'=>$v['asset']['sha256'],'target'=>array('width_inches'=>$o['width'],'height_inches'=>$o['height'],'ppi'=>300),'export_metadata'=>$m,'checks'=>$checks,'overall'=>$overall,'findings'=>$q['pixel_review']['findings']??array(),'local_approval'=>$approved,'scope'=>'digital_finishing_only','production_approved'=>false,'proof_scope'=>'Screen garment colours are contrast previews, not physical print proofs.','reuse_policy'=>array('same_bytes_same_target'=>'Reuse recorded checks; review brand placement and garment variants.','changed_bytes'=>'Repeat pixel, colour, alpha and fidelity checks on changed artwork.','changed_target'=>'Repeat effective PPI, fit and garment placement checks.'),'generation_provenance'=>$q['generation_provenance']??($record['original_qa']['generation_provenance']??null),'freestyle_source'=>$record['freestyle_source']??null,'processing_provenance'=>array_map(function($version){return array('version'=>$version['uuid'],'options'=>$version['options'],'sha256'=>$version['asset']['sha256']);},$record['versions']),'print_placement'=>$fit);
    }
    public static function production_rechecks($manifest,$sha256,$target)
    {
        if(!is_array($manifest)||($manifest['schema']??0)!==self::SCHEMA||empty($manifest['candidate_sha256'])||!hash_equals($manifest['candidate_sha256'],$sha256)||($manifest['overall']??'')!=='PASS'||empty($manifest['local_approval'])){return array('reuse'=>array(),'recheck'=>array('pixels','colour','alpha','fidelity','ppi','placement','brand_assets','garment_variants'),'production_approved'=>false);}
        $same_target=($manifest['target']??array())===$target;
        return array('reuse'=>$same_target?array_keys($manifest['checks']):array('export_format','alpha_and_edges','human_fidelity'),'recheck'=>$same_target?array('placement','brand_assets','garment_variants'):array('ppi','fit','placement','brand_assets','garment_variants'),'production_approved'=>false);
    }
}
