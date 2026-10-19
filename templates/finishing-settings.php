<?php $sbs_google_signed_in = SBS_Auth::is_authenticated(); ?>
<section class="sbs-card sbs-af" aria-labelledby="sbs-google-title">
    <h2 id="sbs-google-title">Artwork Finishing — Google Drive</h2>
    <p id="sbs-google-status" role="status" aria-live="polite" aria-atomic="true"><?php echo $sbs_google_signed_in ? 'Connection not checked. Use Check connection status to see the saved settings.' : 'Studio sign-in required. Sign in above before saving or checking Google settings.'; ?></p>
    <p>Google sign-in is separate from ChatGPT's Drive connection. Drive access is limited to images and folders you choose in Google's picker. Studio uploads a new approved package and checks its saved file and checksum; it does not update artwork registers.</p>
    <details><summary>Google Cloud client settings</summary>
        <form id="sbs-google-config"><label for="sbs-google-client">OAuth web application client ID<input id="sbs-google-client" type="text" autocomplete="off" required <?php disabled(!$sbs_google_signed_in); ?>></label><label for="sbs-google-secret">Client secret — encrypted on the server<input id="sbs-google-secret" type="password" autocomplete="new-password" <?php disabled(!$sbs_google_signed_in); ?>></label><label for="sbs-google-picker-key">Google Picker browser key<input id="sbs-google-picker-key" type="password" autocomplete="new-password" <?php disabled(!$sbs_google_signed_in); ?>></label><p>The browser key is not a password, but restrict it in Google Cloud to growinsane.com and docs.google.com, and to Google Picker API and Drive API. Leave either key field empty to keep its saved value. The client secret is never returned. You can add the Picker key while connected. Leave the client secret empty to preserve the connection. Disconnect only before replacing the OAuth client. Any Studio password holder can configure this shared connection.</p><button class="sbs-button" type="submit" <?php disabled(!$sbs_google_signed_in); ?>>Save encrypted Google client settings</button></form>
    </details>
    <p>Authorised redirect URI: <code id="sbs-google-redirect"><?php echo esc_html(SBS_Google_Drive::redirect_uri()); ?></code></p>
    <button id="sbs-google-connect" class="sbs-button" type="button" disabled>Connect Google Drive</button>
    <button id="sbs-google-reconnect" class="sbs-button" type="button" disabled>Reconnect Google Drive</button>
    <button id="sbs-google-disconnect" class="sbs-button" type="button" disabled>Disconnect Google Drive</button>
    <button id="sbs-google-refresh" class="sbs-button" type="button" <?php disabled(!$sbs_google_signed_in); ?>>Check connection status</button>
</section>
