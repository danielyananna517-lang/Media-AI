const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('.tab')];

const modes={
  chat:{title:'Չատ',help:'Գրիր առաջադրանքը բնական լեզվով։',label:'Հաղորդագրություն',placeholder:'Օրինակ՝ գրիր մանկական հեքիաթ 6 տարեկան երեխայի համար...'},
  image:{title:'Պատկեր',help:'Գրիր՝ ինչ պատկեր պետք է ստեղծվի։',label:'Պատկերի առաջադրանք',placeholder:'Օրինակ՝ մանկական հեքիաթի ջերմ, գունավոր տեսարան...'},
  book:{title:'Գիրք',help:'Նկարագրիր գիրքը։',label:'Գրքի առաջադրանք',placeholder:'Օրինակ՝ 24 էջանոց մանկական գիրք, թեման՝ ընկերություն...'},
  'video-clip':{title:'Տեսանյութ',help:'Նկարագրիր տեսանյութի կամ հոլովակի առաջադրանքը։',label:'Տեսանյութի առաջադրանք',placeholder:'Օրինակ՝ 10 վայրկյանանոց անիմացիոն հոլովակ...'},
  voice:{title:'Ձայն',help:'Գրիր տեքստը ձայնի համար։',label:'Տեքստ',placeholder:'Գրիր այն տեքստը, որը պետք է կարդացվի։'},
  transcribe:{title:'Տառադարձում',help:'Տեքստ ստանալու համար փոխանցիր մուտքային տվյալների նկարագրությունը։',label:'Մուտքային տվյալ',placeholder:'Նշիր աուդիոյի հղումը կամ պայմանագիրը։'}
};

let mode='chat';

function render(){
  const m=modes[mode];
  $('modeTitle').textContent=m.title;
  $('modeHelp').textContent=m.help;
  $('mainLabel').textContent=m.label;
  $('mainInput').placeholder=m.placeholder;
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.mode===mode));
}

tabs.forEach(t=>t.addEventListener('click',()=>{mode=t.dataset.mode;render();}));

$('healthBtn').addEventListener('click',async()=>{
  $('statusText').textContent='Ստուգում...';
  try{
    const r=await fetch('/api/media-health');
    const d=await r.json();
    const ok=d?.ok===true;
    $('statusDot').style.background=ok?'#12b76a':'#f04438';
    $('statusText').textContent=ok?'Media AI՝ հասանելի':'Media AI՝ հասանելի չէ';
  }catch{
    $('statusDot').style.background='#f04438';
    $('statusText').textContent='Կապի սխալ';
  }
});

$('runBtn').addEventListener('click',async()=>{
  const value=$('mainInput').value.trim();
  if(!value){$('result').textContent='Մուտքագրիր տվյալ։';return;}
  $('runBtn').disabled=true;
  $('result').textContent='Կատարվում է...';
  const input={message:value};
  if(mode==='image') input.prompt=value;
  if(mode==='book') input.prompt=value;
  if(mode==='video-clip') input.prompt=value;
  if(mode==='voice') input.text=value;
  if(mode==='transcribe') input.source=value;

  try{
    const r=await fetch('/api/media',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:mode,input})});
    const d=await r.json();
    $('result').textContent=JSON.stringify(d,null,2);
  }catch(e){
    $('result').textContent=JSON.stringify({status:'error',error:'ui_request_failed',message:e.message},null,2);
  }finally{
    $('runBtn').disabled=false;
  }
});

render();
