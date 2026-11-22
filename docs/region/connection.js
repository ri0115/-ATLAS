"use strict";
// Regional page does not retain or read credentials. Authentication is owned by the main ATLAS application.
// The protected region-profile endpoint is not yet deployed, so no speculative requests are issued.
(()=>{
 const status=document.getElementById("region-status");
 const region=document.getElementById("region-area");
 if(region)region.disabled=true;
 if(status)status.textContent="地域を選択し「調べる」を押すとATLASの認証画面に進みます";
})();
