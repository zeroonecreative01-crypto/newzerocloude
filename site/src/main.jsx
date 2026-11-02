import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Plus, X, Menu, Asterisk } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './styles.css';

gsap.registerPlugin(ScrollTrigger);

const capabilities = [
  ['01','Brand strategy','Positioning, research, naming and a point of view that gives a business direction.'],
  ['02','Identity systems','Distinctive visual and verbal identities designed to stay consistent as brands grow.'],
  ['03','Digital experiences','Websites and digital products shaped around clarity, craft and conversion.'],
  ['04','Campaigns & content','Creative direction, film, photography and social content built around one strong idea.'],
  ['05','Growth & performance','Paid media, testing and optimisation that connect creative work to measurable outcomes.']
];

const projects = [
  { n:'01', type:'IDENTITY / ART DIRECTION', name:'A different kind of presence', tag:'Brand worlds', cls:'project-visual-one' },
  { n:'02', type:'DIGITAL / EXPERIENCE', name:'Designed to move forward', tag:'Digital systems', cls:'project-visual-two' },
  { n:'03', type:'CAMPAIGN / CONTENT', name:'Make the moment matter', tag:'Campaign thinking', cls:'project-visual-three' }
];

function App(){
  const [menu,setMenu]=useState(false);
  const [active,setActive]=useState(0);
  const [form,setForm]=useState({name:'',email:'',company:'',service:'',message:''});
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    const lenis=new Lenis({duration:1.05,smoothWheel:true});
    lenis.on('scroll',ScrollTrigger.update);
    const tick=t=>lenis.raf(t*1000);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    const ctx=gsap.context(()=>{
      gsap.utils.toArray('[data-reveal]').forEach(el=>gsap.fromTo(el,{y:28,autoAlpha:0},{y:0,autoAlpha:1,duration:.85,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 88%',once:true}}));
      gsap.to('.hero-orbit',{rotate:360,duration:38,repeat:-1,ease:'none'});
      gsap.to('.hero-image',{yPercent:-7,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
    });
    return()=>{ctx.revert();lenis.destroy();gsap.ticker.remove(tick)};
  },[]);

  const jump=id=>{setMenu(false);document.querySelector(id)?.scrollIntoView({behavior:'smooth'});};
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,website:''})});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'Unable to send your message.');
      setSent(true);
    }catch(err){setError(err.message||'Something went wrong. Please try WhatsApp instead.');}
    finally{setBusy(false);}
  };

  return <div className="site-shell">
    <header className="header">
      <a className="wordmark" href="#top" aria-label="ZERO ONE home"><span className="mark">0<span>1</span></span><span>ZERO ONE<sup>®</sup></span></a>
      <div className="header-note">INDEPENDENT CREATIVE COMPANY<br/>CAIRO · WORKING EVERYWHERE</div>
      <nav className="desktop-nav"><a href="#work">WORK</a><a href="#about">ABOUT</a><a href="#capabilities">CAPABILITIES</a><a href="#contact">CONTACT <ArrowUpRight size={13}/></a></nav>
      <button className="mobile-menu" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button>
    </header>
    <div className={'mobile-panel '+(menu?'open':'')}><button onClick={()=>jump('#work')}>WORK <ArrowUpRight/></button><button onClick={()=>jump('#about')}>ABOUT <ArrowUpRight/></button><button onClick={()=>jump('#capabilities')}>CAPABILITIES <ArrowUpRight/></button><button onClick={()=>jump('#contact')}>CONTACT <ArrowUpRight/></button></div>

    <main id="top">
      <section className="hero">
        <div className="hero-topline"><span>CREATIVE THINKING. COMMERCIAL IMPACT.</span><span>EST. 2026&nbsp; / &nbsp;01—∞</span></div>
        <div className="hero-layout">
          <div className="hero-copy">
            <p className="eyebrow"><i/> BUILT FOR THE AMBITIOUS</p>
            <h1>MAKE<br/>THE <em>NEXT</em><br/>MOVE<span className="period">.</span></h1>
            <div className="hero-foot"><p>We turn sharp ideas into brands, experiences and momentum.</p><a href="#work" className="round-link" aria-label="Explore work"><ArrowUpRight/></a></div>
          </div>
          <div className="hero-art">
            <div className="hero-image"></div>
            <div className="hero-orbit"><span>ZERO ONE&nbsp; · &nbsp;FROM 0 TO 1&nbsp; · &nbsp;ZERO ONE&nbsp; · &nbsp;FROM 0 TO 1&nbsp; · &nbsp;</span></div>
            <div className="hero-index"><b>01</b><span>IDEAS INTO<br/>IMPACT.</span></div>
            <div className="hero-caption">A CLEAR POINT OF VIEW<br/>CHANGES EVERYTHING.</div>
          </div>
        </div>
        <div className="hero-bottom"><span>STRATEGY / IDENTITY / EXPERIENCE / GROWTH</span><a href="#about">DISCOVER ZERO ONE <ArrowDownRightIcon/></a></div>
      </section>

      <section className="intro section-pad" id="about">
        <div className="section-label"><span>01 / THE POINT OF VIEW</span><span>LESS NOISE. MORE MEANING.</span></div>
        <div className="intro-grid">
          <h2 data-reveal>From a first<br/>thought to a<br/><em>real difference.</em></h2>
          <div className="intro-copy" data-reveal><Asterisk className="asterisk"/><p>Ambition deserves more than another agency-shaped answer. ZERO ONE brings strategy and creativity into one focused system — turning business challenges into clear ideas, distinctive brands and experiences people remember.</p><a href="#capabilities" className="text-link">WHAT WE BRING <ArrowUpRight/></a></div>
        </div>
        <div className="intro-bottom"><span>INDEPENDENT BY DESIGN.</span><span>BUILT AROUND YOUR AMBITION.</span></div>
      </section>

      <section className="work section-pad" id="work">
        <div className="section-label"><span>02 / SELECTED DIRECTIONS</span><span>GOOD WORK STARTS WITH A GOOD QUESTION.</span></div>
        <div className="work-heading"><h2 data-reveal>Ideas with<br/><em>somewhere</em><br/>to go<span>.</span></h2><p data-reveal>We don't believe in decoration for decoration's sake. Every detail has a job. Every move has a reason.</p></div>
        <div className="project-grid">{projects.map(p=><article className="project" key={p.n}><div className={'project-visual '+p.cls}><div className="visual-label">{p.tag}</div><div className="visual-symbol">{p.n==='01'?'Z/01':p.n==='02'?'MOVE':'MAKE'}</div><span className="visual-corner">ZERO ONE®</span></div><div className="project-meta"><span>{p.n} / {p.type}</span><ArrowUpRight size={17}/></div><h3>{p.name}</h3></article>)}</div>
        <p className="work-note">SELECTED CREATIVE DIRECTIONS — FULL CASE STUDIES COMING SOON.</p>
      </section>

      <section className="statement">
        <div className="statement-top"><span>03 / THE ZERO ONE PRINCIPLE</span><span>FROM 0 TO 1.</span></div>
        <h2 data-reveal>THE FIRST<br/>MOVE IS A<br/><em>DECISION.</em></h2>
        <div className="statement-bottom"><span>CLARITY BEFORE COMPLEXITY.</span><p>We ask better questions, find the real opportunity, then make the work that moves it forward.</p></div>
      </section>

      <section className="capabilities section-pad" id="capabilities">
        <div className="section-label"><span>04 / WHAT WE DO</span><span>ONE CONNECTED CREATIVE SYSTEM.</span></div>
        <div className="cap-heading"><h2 data-reveal>Make every<br/><em>move</em> count.</h2><p data-reveal>From the first strategic question to the final customer touchpoint, the pieces work better together.</p></div>
        <div className="cap-list">{capabilities.map((c,i)=><div className={'cap-item '+(active===i?'active':'')} key={c[0]}><button onClick={()=>setActive(active===i?-1:i)}><span>{c[0]}</span><strong>{c[1]}</strong><i>{active===i?<X/>:<Plus/>}</i></button>{active===i&&<div className="cap-detail"><p>{c[2]}</p><a href="#contact" onClick={()=>setActive(-1)}>LET'S TALK <ArrowUpRight/></a></div>}</div>)}</div>
        <div className="cap-footer"><span>THINK CLEARLY.</span><span>MAKE IT MATTER.</span><span>KEEP MOVING.</span></div>
      </section>

      <section className="contact section-pad" id="contact">
        <div className="section-label"><span>05 / YOUR NEXT MOVE</span><span>GOOD THINGS START WITH A CONVERSATION.</span></div>
        <div className="contact-title"><h2>LET'S MAKE<br/><em>IT</em> MATTER<span>.</span></h2><p>Have a challenge, an idea<br/>or a big ambition?<br/>Start here.</p></div>
        <div className="contact-grid">
          <div className="contact-direct"><span className="direct-label">NO DECK NEEDED.</span><a href="https://wa.me/201556764804?text=Hi%20ZERO%20ONE%2C%20I%20want%20to%20start%20a%20project" target="_blank" rel="noreferrer" className="whatsapp-link">START A CONVERSATION <ArrowUpRight/></a><a className="email-link" href="mailto:zeroone.creative.01@gmail.com">ZEROONE.CREATIVE.01@GMAIL.COM</a><span className="location-note">CAIRO, EGYPT / AVAILABLE WORLDWIDE</span></div>
          <div className="form-card">{sent?<div className="success"><span>01 / RECEIVED</span><h3>That's a<br/>good start.</h3><p>Thanks for reaching out. We'll be in touch.</p></div>:<form onSubmit={submit}><div className="form-head"><h3>Tell us what you're building.</h3><span>01 — 05</span></div><div className="form-fields"><label>YOUR NAME<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Name"/></label><label>EMAIL ADDRESS<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="Email"/></label><label>COMPANY / BRAND<input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Optional"/></label><label>WHAT DO YOU NEED?<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})} required><option value="">Choose one</option>{['Strategy','Brand identity','Digital experience','Campaigns & content','Growth & performance','Something else'].map(x=><option key={x}>{x}</option>)}</select></label><label className="full">TELL US A LITTLE ABOUT IT<textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} required minLength={10} placeholder="The opportunity, the challenge, the ambition…"/></label></div>{error&&<p className="error">{error}</p>}<button className="send" disabled={busy}>{busy?'SENDING…':'SEND YOUR BRIEF'} <ArrowUpRight/></button></form>}</div>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="footer-top"><a className="footer-logo" href="#top">ZERO ONE<sup>®</sup></a><span>FROM 0 TO 1. AND EVERY MOVE AFTER.</span><a href="#top">BACK TO TOP ↑</a></div><div className="footer-big">MAKE<br/><em>THE NEXT.</em></div><div className="footer-bottom"><span>© ZERO ONE 2026. ALL RIGHTS RESERVED.</span><span>CAIRO / WORKING EVERYWHERE.</span><span>STRATEGY · IDENTITY · EXPERIENCE · GROWTH</span></div></footer>
  </div>;
}

function ArrowDownRightIcon(){return <ArrowRight size={15}/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
