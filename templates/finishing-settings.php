<section class="sbs-card sbs-af" aria-labelledby="sbs-google-title">
    <h2 id="sbs-google-title">Artwork Finishing — Google Drive</h2>
    <p id="sbs-google-status" role="status" aria-live="polite">Connection not checked.</p>
    <p>Google sign-in is separate from ChatGPT's Drive connection. This preview keeps all Drive file operations disabled, including after connection.</p>
    <details><summary>Google Cloud client settings</summary>
        <form id="sbs-google-config"><label for="sbs-google-client">OAuth web application client ID<input id="sbs-google-client" type="text" autocomplete="off" required></label><label for="sbs-google-secret">Client secret — encrypted on the server<input id="sbs-google-secret" type="password" autocomplete="new-password"></label><p>Secret is never returned. Leave empty to keep the saved secret. Disconnect before replacing a client. Any Studio password holder can configure this shared connection.</p><button class="sbs-button" type="submit">Save encrypted Google client settings</button></form>
    </details>
    <p>Authorised redirect URI: <code id="sbs-google-redirect"></code></p>
    <button id="sbs-google-connect" class="sbs-button" type="button" disabled>Connect Google Drive</button>
    <button id="sbs-google-reconnect" class="sbs-button" type="button" disabled>Reconnect Google Drive</button>
    <button id="sbs-google-disconnect" class="sbs-button" type="button" disabled>Disconnect Google Drive</button>
    <button id="sbs-google-refresh" class="sbs-button" type="button">Check connection status</button>
</section>
