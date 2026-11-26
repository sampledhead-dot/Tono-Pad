(function(){
  var sim=null;
  function b64e(u8){var s='';for(var i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
  function b64d(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
  window.SHUsb={
    list:function(){return '[{"vid":1410,"pid":743,"name":"SP-404MKII"}]';},
    open:function(v,p,b){ setTimeout(function(){ sim=window.__sim=new Sim404({project:2}); sim.onData=function(u8){ window.__shUsbEv('data', b64e(u8)); };
      // una muestra ya cargada en B5 (nota La3 = 220 Hz, 1 s)
      var n=48000,L=new Float32Array(n); for(var i=0;i<n;i++) L[i]=0.5*Math.sin(2*Math.PI*220*i/48000)*Math.min(1,(n-i)/4000);
      var smp=TP.sp404.smpFromFloat(L,L), pad=16+4; sim.fs['/SP404REMOTE///'+TP.sp404.smpPath(3,pad)]=smp;
      var dv=new DataView(sim.pads[pad].buffer); dv.setUint32(3,smp.length,true); dv.setUint32(7,512,true); dv.setUint32(11,smp.length,true); 'BAJO LA'.split('').forEach(function(c,i){sim.pads[pad][175+i]=c.charCodeAt(0);});
      window.__shUsbEv('open','ok'); },10); },
    write:function(s){ sim.write(b64d(s)); return true; },
    close:function(){ setTimeout(function(){window.__shUsbEv('closed','Desconectado.');},0); },
    isOpen:function(){return !!sim;}
  };
})();
