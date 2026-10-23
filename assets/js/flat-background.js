(function () {
    'use strict';
    // Remove only selected RGB colours connected to an image boundary.
    async function eraseConnectedBackground(data,width,height,rgb,tolerance,onProgress) {
        var total=width*height;
        if(!width||!height||total>32000000||data.length!==total*4)throw new Error('Flat-colour removal supports images up to 32 million pixels.');
        var seen=new Uint8Array(total),queue=new Uint32Array(total),head=0,tail=0,removed=0;
        function add(i){if(seen[i])return;seen[i]=1;var p=i*4;if(data[p+3]===0||(Math.abs(data[p]-rgb[0])<=tolerance&&Math.abs(data[p+1]-rgb[1])<=tolerance&&Math.abs(data[p+2]-rgb[2])<=tolerance))queue[tail++]=i;}
        for(var x=0;x<width;x++){add(x);add((height-1)*width+x);}
        for(var y=0;y<height;y++){add(y*width);add(y*width+width-1);}
        if(onProgress)onProgress(0,total);
        while(head<tail){var stop=Math.min(head+65536,tail);while(head<stop){var i=queue[head++],p=i*4;if(data[p+3]){data[p+3]=0;removed++;}var x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<total-width)add(i+width);}
            if(onProgress){onProgress(head,total);await new Promise(function(resolve){setTimeout(resolve,0);});}
        }
        return removed;
    }
    if(typeof window!=='undefined')window.SBSFlatBackground={eraseConnectedBackground:eraseConnectedBackground};
    if(typeof module!=='undefined'&&module.exports)module.exports={eraseConnectedBackground:eraseConnectedBackground};
}());
