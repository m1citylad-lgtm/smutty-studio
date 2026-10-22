<?php $sbs_google_signed_in = SBS_Auth::is_authenticated(); ?>
<section class="sbs-card sbs-af" aria-labelledby="sbs-google-title">
    <h2 id="sbs-google-title">Artwork Finishing — Google Drive</h2>
    <p id="sbs-google-status" role="status" aria-live="polite" aria-atomic="true"><?php echo $sbs_google_signed_in ? 'Connection not checked. Use Check connection status to see the saved settings.' : 'Studio sign-in required. Sign in above before saving or checking Google settings.'; ?></p>
    <p>Google sign-in is separate from ChatGPT. Drive browsing and file transfer are not available yet.</p>
    <details><summary>Google Cloud client settings</summary>
        <form id="sbs-google-config"><label for="sbs-google-client">OAuth web application client ID<input id="sbs-google-client" type="text" autocomplete="off" required <?php disabled(!$sbs_google_signed_in); ?>></label><label for="sbs-google-secret">Client secret — encrypted on the server<input id="sbs-google-secret" type="password" autocomplete="new-password" <?php disabled(!$sbs_google_signed_in); ?>></label><p>Secret stays encrypted. Leave blank to keep it. Disconnect before changing it. Studio password holders can edit these shared settings.</p><button class="sbs-button" type="submit" <?php disabled(!$sbs_google_signed_in); ?>>Save encrypted Google client settings</button></form>
    </details>
    <p>Authorised redirect URI: <code id="sbs-google-redirect"><?php echo esc_html(SBS_Google_Drive::redirect_uri()); ?></code></p>
    <button id="sbs-google-connect" class="sbs-button" type="button" disabled>Connect Google Drive</button>
    <button id="sbs-google-reconnect" class="sbs-button" type="button" disabled>Reconnect Google Drive</button>
    <button id="sbs-google-disconnect" class="sbs-button" type="button" disabled>Disconnect Google Drive</button>
    <button id="sbs-google-refresh" class="sbs-button" type="button" <?php disabled(!$sbs_google_signed_in); ?>>Check connection status</button>
</section>
