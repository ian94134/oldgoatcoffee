import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
export const source = await readFile(new URL('../src/template.html', import.meta.url), 'utf8');
export const original = parseHTML(source).document;
const script = original.querySelector('script[data-dc-script]');
const props = Object.fromEntries(Object.entries(JSON.parse(script.getAttribute('data-props'))).map(([k,v]) => [k,v.default]));
class DCLogic { constructor() { this.props = props; } }
export const Component = vm.runInNewContext(script.textContent + '\nComponent;', {DCLogic, React:{createRef:()=>({current:null})}, queueMicrotask:()=>{}, Date});
export function values(page, state = {}) {
  const component = new Component();
  component.state = {...component.state, page, ...state};
  const vals = component.renderVals();
  // Date-dependent UI is enhanced in the visitor's timezone at runtime.
  vals.days = vals.days.map(day => ({...day, today:false}));
  return {component, vals};
}
