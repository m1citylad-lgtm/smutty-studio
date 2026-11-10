<?php
if (!defined('ABSPATH')) { exit; }
/** Studio identity is deliberately separate from downstream production numbering. */
final class SBS_Intake
{
    const COMPLETE = 'Studio Complete — Awaiting Production';
    public static function validate($series,$name)
    {
        $series=strtoupper(trim((string)$series));$name=sanitize_text_field((string)$name);
        if(!in_array($series,array('SB','MB','TT','PW'),true)){return SBS_Finishing::error('intake_series','Choose Smutty Bear, Madam Butterfly, Torsotopia or Piston Works.');}
        if($name===''||strlen($name)>190){return SBS_Finishing::error('intake_name','Enter an artwork name up to 190 bytes.');}
        return array('series'=>$series,'artwork_name'=>$name,'intake_identity_version'=>1);
    }
    public static function export_record($r,$prefix)
    {
        // Existing workspaces retain their explicit export prefix; new intake has a saved series.
        $series=$r['series']??strtoupper(trim((string)$prefix));
        $name=$r['artwork_name']??preg_replace('/^'.preg_quote($series,'/').'[ _-]+/i','',(string)$r['title']);
        $r['series']=$series;$r['artwork_name']=$name;
        $r['package_title']=!empty($r['intake_identity_version'])?$name:$r['title']; // Preserve legacy transfer checkpoint names.
        $r['production_handoff']=array('status_after_verified_export'=>self::COMPLETE,'numbering'=>'Allocated only by Produce the T-shirt','final_id_allocated_by_studio'=>false);
        return $r;
    }
    public static function report($r)
    {
        return "Series: ".($r['series']??'Not recorded')."\nArtwork name: ".($r['artwork_name']??$r['title'])."\nPermanent design ID: allocated downstream by Produce the T-shirt, not Studio.\n";
    }
    public static function complete($r,$archive)
    {
        if(!empty($archive['verified'])&&!empty($archive['register']['verified'])){$r['status']=self::COMPLETE;$r['next_action']='Produce the T-shirt: allocate the permanent series ID and file the verified master.';}
        return $r;
    }
}
