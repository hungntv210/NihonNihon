// Loaded only by the isolated UI browser fixture, never imported by application code.
const instant=Date.parse(process.env.NIHON_UI_CLOCK_FIXTURE||'');
if(!Number.isFinite(instant))throw Error('UI clock fixture requires an explicit ISO instant');
const RealDate=Date;
globalThis.Date=class extends RealDate{
  constructor(...args){super(...(args.length?args:[instant]));}
  static now(){return instant;}
};
