<?php
if (!defined('ABSPATH')) { exit; }
/** Studio identity is deliberately separate from downstream production numbering. */
final class SBS_Intake
{
    const COMPLETE = 'Studio Complete — Awaiting Production';
    public static function validate($series,$name)
    {
        $series=strtoupper(trim((string)$series));$name=sanitize_text_field((string)$name);
        $list=SBS_Studio_Preferences::read()['series'];
        if(!isset($list[$series])){return SBS_Finishing::error('intake_series','Choose a saved series or use Add to create one.');}
        if($name===''||strlen($name)>190){return SBS_Finishing::error('intake_name','Enter an artwork name up to 190 bytes.');}
        return array('series'=>$series,'series_name'=>$list[$series],'artwork_name'=>$name,'intake_identity_version'=>1);
    }
    public static function export_record($r,$prefix)
    {
        // Existing workspaces retain their explicit export prefix; new intake has a saved series.
        $series=$r['series']??strtoupper(trim((string)$prefix));
        $name=$r['artwork_name']??preg_replace('/^'.preg_quote($series,'/').'[ _-]+/i','',(string)$r['title']);
        $r['series']=$series;$r['series_name']=$r['series_name']??(SBS_Studio_Preferences::read()['series'][$series]??$series);$r['artwork_name']=$name;
        $r['package_title']=!empty($r['intake_identity_version'])?$name:$r['title']; // Preserve legacy transfer checkpoint names.
        $r['production_handoff']=array('status_after_verified_export'=>self::COMPLETE,'numbering'=>'Allocated only by Produce the T-shirt','final_id_allocated_by_studio'=>false);
        return $r;
    }
    public static function report($r)
    {
        return "Series: ".($r['series']??'Not recorded').' — '.($r['series_name']??'')."\nArtwork name: ".($r['artwork_name']??$r['title'])."\nPermanent design ID: allocated downstream by Produce the T-shirt, not Studio.\n";
    }
    public static function complete($r,$archive)
    {
        if(!empty($archive['verified'])&&!empty($archive['register']['verified'])){$r['status']=self::COMPLETE;$r['next_action']='Produce the T-shirt: allocate the permanent series ID and file the verified master.';}
        return $r;
    }
}

/** Shared owner preferences; artwork bytes and approval are never mutated here. */
final class SBS_Studio_Preferences
{
    public static function read()
    {
        $p=get_option('sbs_studio_preferences',array());
        $p=is_array($p)?$p:array();
        return array('revision'=>(int)($p['revision']??0),'series'=>array_merge(array('SB'=>'Smutty Bear','MB'=>'Madam Butterfly','TT'=>'Torsotopia','PW'=>'Piston Works'),$p['series']??array()),'profiles'=>$p['profiles']??array(),'workspaces'=>$p['workspaces']??array());
    }
    public static function strengths($s)
    {
        if(!is_array($s)){return SBS_Finishing::error('settings','Enter all four whole-number percentages.');}
        $out=array();foreach(array('tone','fade','halftone','distress') as $k){
            $v=$s[$k]??null;if(!is_int($v)||$v<0||$v>100){return SBS_Finishing::error('settings','Each percentage must be a whole number from 0 to 100.');}$out[$k]=$v;
        }
        return $out;
    }
    public static function change($p,$q)
    {
        if((int)$q->get_param('revision')!==$p['revision']){return SBS_Finishing::error('preferences_conflict','Settings changed elsewhere. Reload settings and try again.',409);}
        $op=$q->get_param('operation');
        if($op==='series_add'){
            $code=strtoupper(trim((string)$q->get_param('code')));$name=sanitize_text_field((string)$q->get_param('name'));
            if(!preg_match('/^[A-Z]{2}$/D',$code)||$name===''||strlen($name)>150){return SBS_Finishing::error('series','Enter a series name and a unique two-letter code.');}
            if(isset($p['series'][$code])){return SBS_Finishing::error('series','That series code is already used.');}
            foreach($p['series'] as $n){if(strcasecmp($n,$name)===0){return SBS_Finishing::error('series','That series name already exists.');}}
            $p['series'][$code]=$name;
        }elseif($op==='commit'||$op==='profile_save'){
            $s=self::strengths($q->get_param('settings'));if(is_wp_error($s)){return $s;}
            if($op==='commit'){
                $id=(string)$q->get_param('workspace');$preset=(string)$q->get_param('preset');
                if(!preg_match('/^[a-f0-9-]{36}$/D',$id)||!in_array($preset,array('original','clean','vintage','period','custom'),true)){return SBS_Finishing::error('settings','Select a workspace and treatment first.');}
                $p['workspaces'][$id]=array_merge($s,array('preset'=>$preset));
            }else{
                $id=implode('-',array_values($s));if(isset($p['profiles'][$id])){return SBS_Finishing::error('profile','These four values are already saved as a profile.');}
                $p['profiles'][$id]=array('id'=>$id,'name'=>$id,'settings'=>$s);
            }
        }elseif($op==='profile_rename'||$op==='profile_delete'){
            $id=(string)$q->get_param('id');if(!isset($p['profiles'][$id])){return SBS_Finishing::error('profile','Select an existing profile.');}
            if($op==='profile_delete'){
                if($q->get_param('confirm')!==true){return SBS_Finishing::error('profile','Confirm deleting this settings profile.');}unset($p['profiles'][$id]);
            }else{
                $name=sanitize_text_field((string)$q->get_param('name'));if($name===''||strlen($name)>150){return SBS_Finishing::error('profile','Enter a profile name up to 150 bytes.');}
                foreach($p['profiles'] as $key=>$v){if($key!==$id&&strcasecmp($v['name'],$name)===0){return SBS_Finishing::error('profile','That profile name is already used.');}}$p['profiles'][$id]['name']=$name;
            }
        }else{return SBS_Finishing::error('preferences','Unknown settings action.');}
        $p['revision']++;return $p;
    }
    public static function endpoint($q)
    {
        if($q->get_method()==='GET'){return self::read();}
        if(!SBS_Storage::ensure_directories()){return SBS_Finishing::error('preferences','Settings storage is unavailable.');}
        $lock=fopen(SBS_Storage::base_dir().'/preferences.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return SBS_Finishing::error('preferences','Settings are busy. Try again.');}
        try{$p=self::change(self::read(),$q);if(is_wp_error($p)){return $p;}
            if(!update_option('sbs_studio_preferences',$p,false)){return SBS_Finishing::error('preferences','Settings could not be saved. Try again.');}return $p;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
