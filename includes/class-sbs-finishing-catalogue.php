<?php
if (!defined('ABSPATH')) { exit; }

/** Pure, read-only adapter contract. Does not fetch or mutate external records. */
final class SBS_Finishing_Catalogue
{
    const AF_REGISTER = '1LQQAciLLM77nQTiUqaQcOvrpFlUyAWFymX3jWIt8Kb8';
    const IDEAS = '1EXWOTTnNJ92vYtfj0zvum3PYOeHUu2997ApjCVacxCs';
    const CATALOGUE = '1lilS9mBKNkCybMg0vEL4AlwuIfaao8BKDKaXvwH2Ovg';
    const TRACKER = '1-nObo_X2VtN99d9k8N-Px7vb2x7zFdV4VJCChSfq9fU';
    public static function join_sb($catalogue,$tracker,$redbubble)
    {
        $result=array();
        foreach($catalogue as $row){
            $id=$row['Design ID']??'';
            if(!preg_match('/^SB\d{4,}$/D',$id)){continue;}
            $matches=array_values(array_filter($tracker,function($t)use($id){return ($t['SB ID']??'')===$id;}));
            $channels=array_values(array_filter($redbubble,function($t)use($id){return ($t['Design ID']??$t['SB ID']??'')===$id;}));
            $lifecycle=count($matches)===1?$matches[0]:null;
            $result[]=array('sb_id'=>$id,'metadata'=>$row,'lifecycle'=>$lifecycle,'redbubble'=>$channels,'overall_stage'=>$lifecycle['Overall Stage']??'Unverified','next_action'=>$lifecycle['Next Required Action']??'Resolve missing or duplicate lifecycle row','authority'=>self::TRACKER,'conflict'=>count($matches)!==1);
        }
        return $result;
    }
    public static function production_rechecks($manifest,$sha256,$target)
    {
        return SBS_Print_QA::production_rechecks($manifest,$sha256,$target);
    }
    public static function proposed_af_row($record)
    {
        $v=SBS_Finishing::current($record);
        // Mirrors the existing 29-column draft register. Never submit this proposal.
        return array('AF ID'=>null,'Artwork Title'=>$record['title'],'Linked IDEA ID(s)'=>implode(', ',$record['links']['idea_ids']),'Existing SB ID'=>$record['links']['sb_id'],'AF Status'=>$record['status'],'Source Route'=>$record['source_route'],'Intake Date'=>$record['created_at'],'Last Updated'=>$record['updated_at'],'Original Filename'=>$record['original']['filename'],'Original Drive URL'=>null,'Source SHA-256'=>$record['original']['sha256'],'Original Pixels (W × H)'=>$record['original_qa']['width'].' × '.$record['original_qa']['height'],'Background / Alpha'=>$record['original_qa']['alpha'],'Target Pixels (W × H)'=>$v?($v['options']['width']*300).' × '.($v['options']['height']*300):null,'Processing Method'=>$v['options']['method']??null,'Provider Job ID'=>null,'Current Version'=>$v['number']??null,'Candidate Drive URL'=>null,'Output SHA-256'=>$v['asset']['sha256']??null,'Preservation QA'=>'Manual review required','Print Preflight'=>$v['qa']??null,'Review Decision'=>$record['approval']?'Local approval only':null,'Approved Date'=>$record['approval']['at']??null,'Handoff Date'=>null,'AF Folder URL'=>null,'Last AF Action'=>end($record['audit']),'Next AF Action'=>$record['next_action'],'Blocked / Issue'=>'Google integration deferred; AF allocation disabled','Notes'=>'Proposal only; references unverified');
    }
}
