<?php
require_once __DIR__ . "/class-sbs-intake.php";
if (!defined('ABSPATH')) { exit; }

/** Optional post-processing. All mutations use the existing workspace lock/revision. */
final class SBS_Final_Print
{
    const ENGINE = 'final-print-1';
    public static function register_routes()
    {
        register_rest_route(SBS_REST::NS, '/finishing/final-library', array('methods'=>'GET,POST','callback'=>array(__CLASS__,'library'),'permission_callback'=>array('SBS_Finishing','permission')));
    }
    public static function handles($a) { return in_array($a,array('final_assess','final_save_preview','final_begin','final_finish','final_keep','final_check','final_approve','final_brand','final_settings','final_proofs','final_export'),true); }
    private static function error($m) { return SBS_Finishing::error('final_print',$m,422); }
    public static function intact($a)
    {
        return is_array($a)&&!empty($a['sha256'])&&is_file(SBS_Storage::absolute_path($a))&&hash_equals($a['sha256'],hash_file('sha256',SBS_Storage::absolute_path($a)));
    }
    private static function item($id,$kind)
    {
        foreach(self::items() as $i){if($i['id']===$id&&$i['kind']===$kind&&empty($i['archived'])){return $i;}}
        return self::error('That library item is unavailable. Select an active item.');
    }
    private static function items() { return array_values((array)get_option('sbs_final_library',array())); }
    public static function library($request)
    {
        if($request->get_method()==='GET'){return array('items'=>self::items(),'engine'=>self::ENGINE);}
        if(!SBS_Storage::ensure_directories()){return self::error('Private library storage is unavailable.');}
        $lock=fopen(SBS_Storage::base_dir().'/final-library.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('The asset library is busy. Try again.');}
        try {
            $items=self::items();$id=(string)$request->get_param('id');$op=(string)$request->get_param('operation');
            if($op==='archive'){
                if($request->get_param('confirm')!==true){return self::error('Confirm archiving this imported asset. Existing packages stay intact.');}
                $found=false;foreach($items as &$i){if($i['id']===$id){$i['archived']=true;$found=true;}}unset($i);
                if(!$found){return self::error('The imported item was not found.');}
            } else {
                $kind=(string)$request->get_param('kind');$label=sanitize_text_field((string)$request->get_param('label'));$note=sanitize_textarea_field((string)$request->get_param('source_note'));
                if(!in_array($kind,array('logo','template'),true)||$label===''||strlen($label)>180||$note===''||strlen($note)>3000){return self::error('Enter a name and source/licence note for this logo or shirt template.');}
                if($request->get_param('approved')!=='1'&&$request->get_param('approved')!==true){return self::error('Confirm that you may use this asset and, for logos, that it is the approved genuine master.');}
                $files=$request->get_file_params();$file=$files['file']??null;$old=null;
                if($id!==''){foreach($items as $i){if($i['id']===$id){$old=$i;}}if(!$old||$old['kind']!==$kind){return self::error('The item changed. Reload the asset library.');}}
                $asset=$old['asset']??null;
                if($file&&!empty($file['tmp_name'])){
                    $size=@getimagesize($file['tmp_name']);
                    if(!empty($file['error'])||!$size||!in_array($size['mime'],array('image/png','image/jpeg','image/webp'),true)||$size[0]*$size[1]>25000000||(int)$file['size']>20*1024*1024){return self::error('Use a readable PNG, JPEG or WebP up to 20 MB and 25 million pixels.');}
                    if($kind==='logo'&&$size['mime']!=='image/png'){return self::error('Use the genuine transparent PNG logo master.');}
                    $asset=SBS_Storage::store_upload($file,'finishing',0,'final_'.$kind,$label);if(is_wp_error($asset)){return $asset;}
                    if($kind==='logo'){$sample=SBS_Print_QA::sample(SBS_Storage::absolute_path($asset));if($sample['status']!=='sampled'||empty($sample['clear_samples'])){return self::error('This logo has no verified transparent exterior. Use its transparent PNG master.');}}
                }
                if(!$asset||!self::intact($asset)){return self::error('Choose a valid source image.');}
                foreach($items as $i){if($i['id']!==$id&&empty($i['archived'])&&$i['kind']===$kind&&$i['asset']['sha256']===$asset['sha256']){return self::error('This exact image is already in the library: '.$i['label']);}}
                $geometry=$request->get_param('geometry');if(is_string($geometry)){$geometry=json_decode($geometry,true);}$geometry=self::geometry($geometry?:array());if(is_wp_error($geometry)){return $geometry;}
                $record=array('id'=>wp_generate_uuid4(),'kind'=>$kind,'label'=>$label,'asset'=>$asset,'source_note'=>$note,'source_file_id'=>sanitize_text_field((string)$request->get_param('source_file_id')),'series'=>sanitize_text_field((string)$request->get_param('series')),'colour'=>sanitize_text_field((string)$request->get_param('colour')),'provider'=>sanitize_text_field((string)$request->get_param('provider')),'model'=>sanitize_text_field((string)$request->get_param('model')),'size'=>sanitize_text_field((string)$request->get_param('garment_size')),'view'=>sanitize_key((string)$request->get_param('view'))?:'front','signature'=>$request->get_param('signature')==='1','geometry'=>$geometry,'version'=>($old['version']??0)+1,'previous_id'=>$old['id']??null,'approved_by_owner'=>true,'created_at'=>gmdate('c'),'archived'=>false);
                if($old){foreach($items as &$i){if($i['id']===$id){$i['archived']=true;}}unset($i);}$items[]=$record;
            }
            update_option('sbs_final_library',$items,false);
            if(wp_json_encode(self::items())!==wp_json_encode($items)){return self::error('The library write could not be verified. Reload before retrying.');}
            return array('items'=>$items,'engine'=>self::ENGINE);
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function geometry($input)
    {
        $out=array();foreach(array('x'=>.28,'y'=>.24,'w'=>.44,'h'=>.59) as $k=>$default){$n=$input[$k]??$default;if(!is_numeric($n)||!is_finite((float)$n)||$n<0||$n>1){return self::error('Print-region values must be proportions between 0 and 1.');}$out[$k]=(float)$n;}
        if($out['w']<=0||$out['h']<=0||$out['x']+$out['w']>1||$out['y']+$out['h']>1){return self::error('Keep the whole print region inside the shirt image.');}return $out;
    }
    public static function placement($s)
    {
        $out=array();foreach(array('x'=>.5,'y'=>.3,'width'=>.22) as $k=>$d){$n=$s[$k]??$d;if(!is_numeric($n)||!is_finite((float)$n)||$n<0||$n>1){return self::error('Placement is outside the image.');}$out[$k]=(float)$n;}if($out['width']<=0){return self::error('Choose a positive logo width.');}
        $bends=$s['bends']??array();if(!is_array($bends)||count($bends)>2){return self::error('Use one or two signature bend points.');}$out['bends']=array();
        foreach($bends as $b){if(!is_numeric($b['x']??null)||!is_numeric($b['y']??null)||$b['x']<.1||$b['x']>.9||abs($b['y'])>.25){return self::error('Use gentle signature bends inside the text.');}$out['bends'][]=array('x'=>(float)$b['x'],'y'=>(float)$b['y']);}return $out;
    }
    private static function target($request)
    {
        return SBS_Finishing::options(array('width'=>$request->get_param('width')??14,'height'=>$request->get_param('height')??16));
    }
    private static function image($a)
    {
        if(!self::intact($a)){return self::error('The source checksum does not match. Original files are retained.');}
        if(!class_exists('Imagick')){return self::error('This finishing stage needs the server Imagick image tools.');}
        $m=SBS_Print_QA::metadata(SBS_Storage::absolute_path($a));
        if($m['mime']!=='image/png'||!in_array($m['profile'],array('srgb_icc','srgb_chunk','untagged'),true)){return self::error('Prepare an sRGB print PNG in Stage 1 before applying a finish or logo.');}
        $im=new Imagick(SBS_Storage::absolute_path($a));$im->setIteratorIndex(0);if($im->getNumberImages()!==1){$im->clear();return self::error('Use a single-frame PNG.');}return $im;
    }
    private static function store($im,$label,$source,$settings)
    {
        $im->setImageDepth(8);$im->setImageFormat('png32');$im->setOption('png:color-type','6');$im->setOption('png:bit-depth','8');
        $bytes=SBS_Print_QA::tag_png($im->getImageBlob());$im->clear();
        if(!is_string($bytes)||$bytes===''){return self::error('No PNG was produced. The previous version is kept.');}
        return SBS_Storage::store_bytes($bytes,$label.'-'.wp_generate_uuid4().'.png','image/png','finishing',0,$label,$label,array('engine'=>self::ENGINE,'source_sha256'=>$source['sha256'],'settings'=>$settings,'generative_redraw'=>false));
    }
    private static function result($a,$o,$source,$settings)
    {
        $qa=SBS_Finishing::inspect($a,$o);if(is_wp_error($qa)){return $qa;}
        return array('asset'=>$a,'source_sha256'=>$source['sha256'],'settings'=>$settings,'qa'=>$qa,'created_at'=>gmdate('c'),'approval'=>null,'technical'=>array('status'=>empty($qa['warnings'])?'PASS':'REVIEW','reasons'=>$qa['warnings']),'visual'=>array('status'=>'REVIEW','reason'=>'Inspect the whole design, lettering, face, normal skin/clothes/boots, effects and all four garment colours. Automated aesthetic approval is not claimed.'));
    }
    private static function history(&$r)
    {
        if(!empty($r['final_print'])){$r['final_print_history'][]=$r['final_print'];}
    }
    public static function handle($r,$q)
    {
        if(!empty($r['pending'])){return self::error('Finish or cancel the waiting Stage 1 operation first.');}
        $action=$q->get_param('action');$o=self::target($q);if(is_wp_error($o)){return $o;}
        $a=SBS_Finishing_Flow::source($r);
        if($action==='final_begin'){
            if(!self::intact($a)||($a['mime']??'')!=='image/png'){return self::error('Select a saved high-resolution PNG or import a PNG for direct entry.');}
            $qa=SBS_Finishing::inspect($a,$o);if(is_wp_error($qa)){return $qa;}
            if(($r['final_print']['clean']['sha256']??'')===$a['sha256']&&array_map('floatval',(array)($r['final_print']['target']??array()))===array((float)$o['width'],(float)$o['height'])){return $r;}
            self::history($r);$r['final_print']=array('engine'=>self::ENGINE,'clean'=>$a,'clean_qa'=>$qa,'stage1_approval'=>($r['approval']['sha256']??'')===$a['sha256']?$r['approval']:null,'target'=>array($o['width'],$o['height']),'finished'=>null,'branded'=>null,'brand_decision'=>null,'proofs'=>array(),'started_at'=>gmdate('c'),'settings'=>array());return $r;
        }
        $f=$r['final_print']??null;if(!$f||!self::intact($f['clean'])){return self::error('Load a source into Final Finish or Logo & Mockup first.');}
        if(array_map('floatval',(array)$f['target'])!==array((float)$o['width'],(float)$o['height'])){return self::error('The print target changed. Reload this source to start a separate finishing run.');}
        if($a['sha256']!==$f['clean']['sha256']){return self::error('The selected Stage 1 image changed. Load the new source first; the earlier finishing run is retained.');}
        if($action==='final_assess'){
            $preset=(string)$q->get_param('preset');if(!in_array($preset,array('clean','vintage','period','custom'),true)){return self::error('Select a treatment to assess.');}
            $cache_key=$f['clean']['sha256'].':'.$preset;
            if(($f['assessment']['key']??'')!==$cache_key){$assessment=SBS_OpenAI::assess_finish($f['clean']['id'],$preset);if(is_wp_error($assessment)){return $assessment;}$assessment['key']=$cache_key;$assessment['preset']=$preset;$assessment['at']=gmdate('c');$f['assessment']=$assessment;}
            $r['final_print']=$f;return $r;
        }
        if($action==='final_save_preview'){
            $file=$q->get_file_params()['file']??null;$settings=json_decode((string)$q->get_param('settings'),true);
            if(!$file||!empty($file['error'])||($file['size']??0)>64*1024*1024||!is_array($settings)||$q->get_param('source_sha256')!==$f['clean']['sha256']){return self::error('The preview source or upload is invalid. Preview again before saving.');}
            foreach(array('tone','fade','halftone','distress') as $k){if(!is_numeric($settings[$k]??null)||$settings[$k]<0||$settings[$k]>100){return self::error('Preview strengths must be between 0 and 100.');}}
            $size=@getimagesize($file['tmp_name']);if(!$size||$size['mime']!=='image/png'||$size[0]*$size[1]>40000000){return self::error('Use the PNG produced by Preview treatment.');}
            $source=self::image($f['clean']);if(is_wp_error($source)){return $source;}
            if($size[0]!==$source->getImageWidth()||$size[1]!==$source->getImageHeight()){$source->clear();return self::error('Preview dimensions changed. The candidate was not saved.');}
            $im=new Imagick($file['tmp_name']);$alpha=clone $source;$alpha->setImageAlphaChannel(Imagick::ALPHACHANNEL_EXTRACT);$test=clone $im;$test->setImageAlphaChannel(Imagick::ALPHACHANNEL_EXTRACT);$difference=$alpha->compareImages($test,Imagick::METRIC_MEANABSOLUTEERROR);$test->clear();$difference[0]->clear();
            if($difference[1]>0){$im->clear();$source->clear();$alpha->clear();return self::error('Preview transparency changed. The candidate was not saved.');}
            $source->clear();$alpha->clear();$settings['preset']=in_array($settings['preset']??'',array('clean','vintage','period','custom'),true)?$settings['preset']:'custom';$settings['engine']='pixel-treatment-2';$settings['alpha_changed']=false;
            $out=self::store($im,'candidate-finished',$f['clean'],$settings);if(is_wp_error($out)){return $out;}self::history($r);$f['finished']=self::result($out,$o,$f['clean'],$settings);if(is_wp_error($f['finished'])){return $f['finished'];}$f['branded']=null;$f['brand_decision']=null;$f['proofs']=array();$r['final_print']=$f;return $r;
        }
        if($action==='final_keep'){
            self::history($r);$f['finished']=self::result($f['clean'],$o,$f['clean'],array('preset'=>'original','operation'=>'identity','file_alias'=>'clean','alpha_changed'=>false));
            if(is_wp_error($f['finished'])){return $f['finished'];}$f['finished']['finish_status']='APPROVED_NO_ADDITIONAL_FINISH';
            $f['finished']['visual']=array('status'=>'REVIEW','reason'=>'Original selected by owner; no additional treatment.');
            if($f['stage1_approval']){$f['finished']['approval']=array('at'=>gmdate('c'),'sha256'=>$f['clean']['sha256'],'scope'=>'no_additional_finish','reuses_stage1'=>$f['stage1_approval']);}
            $f['branded']=null;$f['brand_decision']=null;$f['proofs']=array();
        } elseif($action==='final_finish'){
            $preset=(string)$q->get_param('preset');if(!in_array($preset,array('clean','vintage','period','custom'),true)){return self::error('Select a listed finish, or Keep Original & Continue.');}
            $zones=$q->get_param('zones')?:array();if(!is_array($zones)||count($zones)>30){return self::error('Choose at most 30 texture areas.');}$valid=array();foreach($zones as $z){$z=self::geometry($z);if(is_wp_error($z)){return $z;}$valid[]=$z;}
            $strength=$q->get_param('strength')??.25;if(!is_numeric($strength)||$strength<0||$strength>1){return self::error('Choose finish strength between 0 and 1.');}
            $settings=array('preset'=>$preset,'strength'=>(float)$strength,'zones'=>$valid,'mask_policy'=>'all texture protected except owner-selected rectangles','alpha_changed'=>false,'halftone'=>'RGB simulation; opaque ink, no transparent gaps','engine'=>self::ENGINE);
            $im=self::image($f['clean']);if(is_wp_error($im)){return $im;}$w=$im->getImageWidth();$h=$im->getImageHeight();
            // Bounded tonal adjustment applies to RGB only. No silhouette, alpha, or geometry changes.
            $alpha=clone $im;$alpha->setImageAlphaChannel(Imagick::ALPHACHANNEL_EXTRACT);
            $im->modulateImage(100-(float)$strength*2,100-(float)$strength*($preset==='period'?12:6),100);
            foreach($valid as $z){$x=(int)round($z['x']*$w);$y=(int)round($z['y']*$h);$zw=max(1,(int)round($z['w']*$w));$zh=max(1,(int)round($z['h']*$h));$draw=new ImagickDraw();$draw->setFillColor(new ImagickPixel('rgba(30,23,18,'.(.10*(float)$strength).')'));$draw->setStrokeOpacity(0);$step=max(8,(int)round($w/350));for($dy=$y+$step;$dy<$y+$zh;$dy+=$step){for($dx=$x+$step;$dx<$x+$zw;$dx+=$step){$rad=max(1,$step*($preset==='vintage'?.2:.12));$draw->circle($dx,$dy,$dx+$rad,$dy);}}$im->drawImage($draw);$draw->clear();}
            $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);$im->compositeImage($alpha,Imagick::COMPOSITE_COPYOPACITY,0,0);$alpha->clear();
            $out=self::store($im,'candidate-finished',$f['clean'],$settings);if(is_wp_error($out)){return $out;}
            self::history($r);$f['finished']=self::result($out,$o,$f['clean'],$settings);if(is_wp_error($f['finished'])){return $f['finished'];}$f['branded']=null;$f['brand_decision']=null;$f['proofs']=array();
        } elseif($action==='final_settings'){
            $settings=$q->get_param('settings');if(!is_array($settings)||strlen(wp_json_encode($settings))>24000){return self::error('Placement settings are invalid or too large.');}
            $f['settings']=$settings;$f['proofs']=array();$f['package_approval']=null;
        } elseif($action==='final_check'||$action==='final_approve'){
            $which=$q->get_param('which')==='branded'?'branded':'finished';$v=$f[$which];if(!$v||!self::intact($v['asset'])){return self::error('Create or select the candidate before checking it.');}
            $qa=SBS_Finishing::inspect($v['asset'],$o);if(is_wp_error($qa)){return $qa;}$v['qa']=$qa;$v['technical']=array('status'=>empty($qa['warnings'])?'PASS':'REVIEW','reasons'=>$qa['warnings']);
            if($action==='final_check'&&$q->get_param('vision')===true){
                if($v['asset']['sha256']===$f['clean']['sha256']){$v['visual']=array('status'=>'REVIEW','reason'=>'Pixels are unchanged; reuse the source review. No duplicate AI check was charged.');}
                else {
                    $report=$v['ai_review']??null;
                    if(!$report||($report['candidate_sha256']??'')!==$v['asset']['sha256']){$report=SBS_OpenAI::review_finishing_artwork($f['clean']['id'],$v['asset']['id'],$r['title'],$o,array(),array('preset'=>$f['finished']['settings']['preset']??'original','branding'=>$which==='branded'));if(is_wp_error($report)){return $report;}$report['candidate_sha256']=$v['asset']['sha256'];}
                    $v['ai_review']=$report;$v['visual']=array('status'=>($report['overall']??'')==='clear'?'PASS':'REVIEW','reason'=>'Advisory AI: '.($report['summary']??'Review the reported areas.').' Owner acceptance is still required.');
                }
            }
            if($action==='final_approve'){
                if($q->get_param('visual_reviewed')!==true||$q->get_param('warnings_reviewed')!==true){return self::error('Review the whole design and acknowledge its technical/placement warnings before approval.');}
                $v['approval']=array('at'=>gmdate('c'),'sha256'=>$v['asset']['sha256'],'target'=>$f['target'],'scope'=>'owner_local_review','warnings_accepted'=>$qa['warnings']);$v['visual']=array('status'=>'PASS','reason'=>'Owner reviewed the whole composition and accepted it. Not an automated aesthetic guarantee.');
            }else{$v['approval']=null;if($q->get_param('vision')!==true){$v['visual']=array('status'=>'REVIEW','reason'=>'Technical checks refreshed. Review the whole design before approving.');}}
            $f[$which]=$v;$f['package_approval']=null;
        } elseif($action==='final_brand'){
            if(empty($f['finished']['approval'])){return self::error('Approve the selected finish or approve keeping the original first.');}
            $base=$f['finished']['asset'];$logo_id=(string)$q->get_param('logo_id');
            if($logo_id==='none'){self::history($r);$f['brand_decision']='APPROVED_NO_LOGO';$f['branded']=null;$f['proofs']=array();}
            else {
                $item=self::item($logo_id,'logo');if(is_wp_error($item)){return $item;}$place=self::placement($q->get_param('placement')?:array());if(is_wp_error($place)){return $place;}
                if($place['bends']&&empty($item['signature'])){return self::error('Curve mode is restricted to owner-approved single-line signatures.');}
                $im=self::image($base);if(is_wp_error($im)){return $im;}$logo=self::image($item['asset']);if(is_wp_error($logo)){$im->clear();return $logo;}
                $w=$im->getImageWidth();$h=$im->getImageHeight();$lw=max(1,(int)round($place['width']*$w));$lh=max(1,(int)round($logo->getImageHeight()*$lw/$logo->getImageWidth()));
                if($lw>$logo->getImageWidth()){ $logo->clear();$im->clear();return self::error('This placement enlarges the logo beyond its native pixels. Use a higher-resolution master or reduce logo size.');}
                $logo->resizeImage($lw,$lh,Imagick::FILTER_LANCZOS,1);
                $bendpad=$place['bends']?(int)ceil($lh*.5):0;
                if($place['bends']){
                    $warped=new Imagick();$warped->newImage($lw,$lh+2*$bendpad,new ImagickPixel('transparent'),'png');
                    for($x=0;$x<$lw;$x++){$t=$x/max(1,$lw-1);$offset=0;foreach($place['bends'] as $b){$d=abs($t-$b['x'])/.5;if($d<1){$offset+=$b['y']*$lh*pow(1-$d*$d,2);}}$strip=clone $logo;$strip->cropImage(1,$lh,$x,0);$strip->setImagePage(0,0,0,0);$warped->compositeImage($strip,Imagick::COMPOSITE_OVER,$x,$bendpad+(int)round($offset));$strip->clear();}$logo->clear();$logo=$warped;$lh=$logo->getImageHeight();
                }
                $left=(int)round($place['x']*$w-$lw/2);$top=(int)round($place['y']*$h-$lh/2);
                if($left<0||$top<0||$left+$lw>$w||$top+$lh>$h){$logo->clear();$im->clear();return self::error('The logo would be clipped. Move it inside the artwork or reduce its size.');}
                $im->compositeImage($logo,Imagick::COMPOSITE_OVER,$left,$top);$logo->clear();$settings=array('logo'=>$item,'placement'=>$place,'alpha_changed'=>true,'bounds_pixels'=>array($left,$top,$lw,$lh));$out=self::store($im,'candidate-branded',$base,$settings);if(is_wp_error($out)){return $out;}
                self::history($r);$f['branded']=self::result($out,$o,$base,$settings);if(is_wp_error($f['branded'])){return $f['branded'];}$f['brand_decision']='LOGO_REVIEW';$f['proofs']=array();
            }
        } elseif($action==='final_proofs'){
            $v=$f['branded']?:$f['finished'];if(!$v||!self::intact($v['asset'])){return self::error('Save a candidate before making shirt proofs.');}
            $template_id=(string)$q->get_param('template_id');$template=$template_id==='generic'?null:self::item($template_id,'template');if(is_wp_error($template)){return $template;}
            $g=$template?$template['geometry']:array('x'=>.28,'y'=>.24,'w'=>.44,'h'=>.59);$p=$q->get_param('print_placement')?:array('x'=>.5,'y'=>.5,'width'=>1);$p=self::placement($p);if(is_wp_error($p)){return $p;}
            $proofs=array();foreach(array('black','white','red','navy') as $colour){
                if($template){if(!self::intact($template['asset'])){return self::error('Template checksum changed.');}$shirt=new Imagick(SBS_Storage::absolute_path($template['asset']));}else{$shirt=new Imagick(SBS_PLUGIN_DIR.'assets/mockups/generic-'.$colour.'.webp');}
                $shirt->setIteratorIndex(0);$shirt->thumbnailImage(1400,1400,true);$sw=$shirt->getImageWidth();$sh=$shirt->getImageHeight();$art=self::image($v['asset']);if(is_wp_error($art)){$shirt->clear();return $art;}
                $maxw=$sw*$g['w'];$maxh=$sh*$g['h'];$ratio=min($maxw/$art->getImageWidth(),$maxh/$art->getImageHeight())*$p['width'];$aw=max(1,(int)round($art->getImageWidth()*$ratio));$ah=max(1,(int)round($art->getImageHeight()*$ratio));
                $x=$sw*$g['x']+$maxw*$p['x']-$aw/2;$y=$sh*$g['y']+$maxh*$p['y']-$ah/2;
                if($x<$sw*$g['x']-1||$y<$sh*$g['y']-1||$x+$aw>$sw*($g['x']+$g['w'])+1||$y+$ah>$sh*($g['y']+$g['h'])+1){$art->clear();$shirt->clear();return self::error('The entire graphic must fit inside the print area. Reduce its size or centre it.');}
                $art->resizeImage($aw,$ah,Imagick::FILTER_LANCZOS,1);
                $bg=new Imagick();$bg->newImage($sw,$sh,new ImagickPixel('#e8e5dc'),'png');$bg->compositeImage($shirt,Imagick::COMPOSITE_OVER,0,0);$bg->compositeImage($art,Imagick::COMPOSITE_OVER,(int)round($x),(int)round($y));$shirt->clear();$art->clear();
                $bg->setImageFormat('webp');$bg->setImageCompressionQuality(85);$asset=SBS_Storage::store_bytes($bg->getImageBlob(),'web-mockup-'.$colour.'-'.wp_generate_uuid4().'.webp','image/webp','finishing',0,'web_mockup',$r['title']);$bg->clear();if(is_wp_error($asset)){return $asset;}
                $proofs[]=array('asset'=>$asset,'colour'=>$template?($template['colour']?:'source photo'):$colour,'template'=>$template?:array('id'=>'generic-'.$colour,'version'=>1,'source'=>'Owner-authorised AI-created generic shirt'),'source_sha256'=>$v['asset']['sha256'],'geometry'=>$g,'print_placement'=>$p,'measured'=>false,'note'=>$template?'Original template colour retained; no verified colour substitution.':'Generic visual reference, not a supplier product, measured garment or physical ink proof.');
                if($template){break;}
            }$f['proofs']=$proofs;$f['package_approval']=null;
        } elseif($action==='final_export'){
            $r=SBS_Intake::export_record($r,$q->get_param('prefix'));
            if(empty($f['finished']['approval'])||($f['branded']&&empty($f['branded']['approval']))||(!$f['branded']&&$f['brand_decision']!=='APPROVED_NO_LOGO')){return self::error('Approve the finish and branded candidate, or explicitly choose No logo.');}
            if($q->get_param('placement_reviewed')!==true){return self::error('Review shirt placement and any anatomical/calibration warnings before exporting.');}
            if(isset($f['settings']['logo_id'])){
                if($f['branded']&&($f['settings']['logo_id']!==$f['branded']['settings']['logo']['id']||wp_json_encode($f['settings']['logo']??null)!==wp_json_encode($f['branded']['settings']['placement']))){return self::error('Logo settings differ from the saved branded candidate. Save and approve the updated branding first.');}
                if(!$f['branded']&&$f['settings']['logo_id']!=='none'){return self::error('Confirm No logo or save the selected logo before exporting.');}
            }
            $v=$f['branded']?:$f['finished'];foreach($f['proofs'] as $proof){if($proof['source_sha256']!==$v['asset']['sha256']){return self::error('Shirt proofs are for an earlier candidate. Make them again.');}}
            if(!$f['proofs']){return self::error('Make and inspect the selected web shirt proofs before package export.');}
            $fingerprint=hash('sha256',wp_json_encode(array($r['uuid'],$f['clean']['sha256'],$f['finished'],$f['branded'],$f['brand_decision'],$f['settings'],$f['proofs'],$r['series'],$r['artwork_name'])));
            $cache_key='sbs_final_export_'.$fingerprint;$snapshot=get_option($cache_key,null);
            if(!$snapshot){
                $f['package_approval']=array('at'=>gmdate('c'),'sha256'=>$v['asset']['sha256'],'scope'=>'local_package_only','physical_calibration'=>'UNVERIFIED','placement_reviewed'=>true);$r['final_print']=$f;
                $artifacts=self::artifacts($r);if(is_wp_error($artifacts)){return $artifacts;}
                $run=count($r['flow']['archive_history']??array())+count($f['exports']??array())+1;$stamp=$fingerprint;
                $snapshot=array('artifacts'=>$artifacts,'run'=>$run,'stamp'=>$stamp,'approval'=>$f['package_approval']);update_option($cache_key,$snapshot,false);
                if(wp_json_encode(get_option($cache_key))!==wp_json_encode($snapshot)){return self::error('Could not save the transfer checkpoint. No files were transferred.');}
            }
            $artifacts=$snapshot['artifacts'];$run=$snapshot['run'];$stamp=$snapshot['stamp'];$f['package_approval']=$snapshot['approval'];
            $archive=SBS_Google_Drive::save_artifacts($artifacts,$r['uuid'],$v['asset']['sha256'],$stamp,$r['artwork_name'],$r['series'],count($r['versions'])+1,$run);if(is_wp_error($archive)){return $archive;}
            $r=SBS_Intake::complete($r,$archive);$f['last_export_stamp']=$stamp;$f['last_export_run']=$run;$f['archive']=$archive;$ids=array_column($f['exports']??array(),'id');if(!in_array($archive['id'],$ids,true)){$f['exports'][]=$archive;}
        }
        if($action!=='final_export'){unset($f['archive'],$f['last_export_stamp'],$f['last_export_run']);}
        $r['final_print']=$f;return $r;
    }
    public static function artifacts($r)
    {
        $f=$r['final_print'];$v=$f['branded']?:$f['finished'];$assets=array('original'=>$r['original'],'candidate-clean'=>$f['clean'],'candidate-finished'=>$f['finished']['asset']);if($f['branded']){$assets['candidate-branded']=$f['branded']['asset'];}
        $out=array();$seen=array();$manifest=array('schema'=>1,'engine'=>self::ENGINE,'workspace'=>$r['uuid'],'title'=>$r['title'],'series'=>$r['series']??null,'artwork_name'=>$r['artwork_name']??$r['title'],'production_handoff'=>$r['production_handoff']??null,'target_inches'=>$f['target'],'files'=>array(),'settings'=>$f['settings'],'finish'=>$f['finished'],'branding'=>$f['branded'],'brand_decision'=>$f['brand_decision'],'proofs'=>$f['proofs'],'approval'=>$f['package_approval'],'production_approved'=>false,'marketplace_published'=>false);
        foreach($assets as $role=>$asset){if(!self::intact($asset)){return self::error('Package source checksum verification failed. No transfer started.');}$hash=$asset['sha256'];if(isset($seen[$hash])){$manifest['files'][$role]=array('alias'=>$seen[$hash],'sha256'=>$hash,'same_file'=>true);continue;}$name=$role.'.'.(pathinfo($asset['filename'],PATHINFO_EXTENSION)?:'png');$seen[$hash]=$name;$manifest['files'][$role]=array('filename'=>$name,'sha256'=>$hash,'bytes'=>(int)filesize(SBS_Storage::absolute_path($asset)));$out[]=array('type'=>$role,'suffix'=>$name,'asset'=>$asset,'mimeType'=>$asset['mime']);}
        foreach($f['proofs'] as $i=>$p){if(!self::intact($p['asset'])){return self::error('Web proof checksum verification failed.');}$name='web-mockup-'.($i+1).'.webp';$out[]=array('type'=>'web_mockup_'.($i+1),'suffix'=>$name,'asset'=>$p['asset'],'mimeType'=>'image/webp');}
        $checks='';foreach($out as $a){$checks.=$a['asset']['sha256'].'  '.$a['suffix']."\n";}
        $report="STUDIO PACKAGE\nOriginal, clean, finished and branded roles have separate provenance. Identical no-finish outputs reference one file and one SHA-256.\nWEB MOCKUPS ARE NOT PRINT FILES. Physical garment/print calibration remains unverified. Owner local approvals do not allocate SB numbers or publish products.\n";
        $report.=SBS_Intake::report($r);
        foreach(array('metadata.json'=>wp_json_encode(array('uuid'=>$r['uuid'],'title'=>$r['title'],'series'=>$r['series']??null,'artwork_name'=>$r['artwork_name']??$r['title'],'production_handoff'=>$r['production_handoff']??null,'original'=>$r['original'],'versions'=>$r['versions'],'approval'=>$r['approval'],'flow'=>$r['flow']??null,'final_print'=>$f),JSON_PRETTY_PRINT),'studio-package-manifest.json'=>wp_json_encode($manifest,JSON_PRETTY_PRINT),'finishing-qa.json'=>wp_json_encode(array('clean'=>$f['clean_qa'],'finish'=>$f['finished']['qa'],'brand'=>$f['branded']['qa']??null,'stage1_manifest'=>$r['qa_manifest']??null),JSON_PRETTY_PRINT),'checksums.sha256'=>$checks,'report.txt'=>$report) as $name=>$bytes){if(!is_string($bytes)){return self::error('Package metadata could not be encoded.');}$mime=substr($name,-5)==='.json'?'application/json':'text/plain';$asset=SBS_Storage::store_bytes($bytes,$name,$mime,'finishing',0,'final_manifest',$r['title']);if(is_wp_error($asset)){return $asset;}$out[]=array('type'=>'manifest_'.str_replace('.','_',$name),'suffix'=>$name,'asset'=>$asset,'mimeType'=>$mime);}
        return $out;
    }
}
