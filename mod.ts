import {
  Cleanup,
  effect,
  scoped,
} from "https://raw.githubusercontent.com/mini-jail/signal/main/mod.ts"

let parentAttrs: Object | undefined
let parentFgt: DOMNode[] | undefined
let parentElt: DOMElement | undefined

export function attributesRef():
  | ElementAttributes & EventAttributes<HTMLElement>
  | undefined
export function attributesRef<T extends keyof HTMLElementTagNameAttributeMap>():
  | HTMLElementTagNameAttributeMap[T]
  | undefined
export function attributesRef<T extends keyof SVGElementTagNameAttributeMap>():
  | SVGElementTagNameAttributeMap[T]
  | undefined
export function attributesRef(): Object | undefined {
  if (parentElt === undefined) return undefined
  if (parentAttrs === undefined) parentAttrs = {}
  return parentAttrs
}

export function elementRef(): HTMLElement | undefined
export function elementRef(): SVGElement | undefined
export function elementRef<T extends keyof HTMLElementTagNameMap>():
  | HTMLElementTagNameMap[T]
  | undefined
export function elementRef<T extends keyof SVGElementTagNameMap>():
  | SVGElementTagNameMap[T]
  | undefined
export function elementRef(): HTMLElement | SVGElement | undefined {
  return parentElt
}

export function addElement<T extends keyof HTMLElementTagNameAttributeMap>(
  tagName: T,
  callback?: (attributes: HTMLElementTagNameAttributeMap[T]) => void,
): void {
  const elt = document.createElement(tagName)
  if (callback) modify(<DOMElement> elt, callback)
  insert(elt)
}

export function addElementNS<T extends keyof SVGElementTagNameAttributeMap>(
  tagName: T,
  callback: (attributes: SVGElementTagNameAttributeMap[T]) => void,
): void {
  const elt = document.createElementNS("http://www.w3.org/2000/svg", tagName)
  if (callback) modify(<DOMElement> elt, callback)
  insert(elt)
}

export function addText(value: any): void {
  insert(document.createTextNode(String(value)))
}

export function render(rootElt: HTMLElement, callback: () => void): Cleanup {
  return scoped((cleanup) => {
    const previousElt = parentElt
    parentElt = <DOMElement> rootElt
    callback()
    parentElt = previousElt
    return cleanup
  })!
}

export function view(callback: () => void): void {
  addElement("slot", () => {
    const ref = parentElt!
    effect<DOMNode[] | undefined>((current) => {
      parentFgt = []
      callback()
      union(ref, current, parentFgt)
      return parentFgt.length > 0 ? parentFgt : undefined
    })
  })
}

export function component<T extends (...args: any[]) => any>(
  callback: T,
): (...args: Parameters<T>) => ReturnType<T> {
  return ((...args) => scoped(() => callback(...args)))
}

function insertBefore(elt: DOMElement, child: DOMNode, anchor: DOMNode): void {
  elt.insertBefore(child, anchor)
}

function union(
  anchor: DOMNode,
  current: (DOMNode | undefined)[] | undefined,
  next: DOMNode[],
): void {
  const elt = <DOMElement> anchor.parentNode
  if (current === undefined) {
    return next.forEach((node) => insertBefore(elt, node, anchor))
  }
  const currentLength = current.length
  const nextLength = next.length
  let currentNode: DOMNode | undefined, i: number, j: number
  outerLoop:
  for (i = 0; i < nextLength; i++) {
    currentNode = current[i]
    for (j = 0; j < currentLength; j++) {
      if (current[j] === undefined) continue
      else if (current[j]!.nodeType === 3 && next[i].nodeType === 3) {
        if (current[j]!.data !== next[i].data) current[j]!.data = next[i].data
        next[i] = current[j]!
      } else if (current[j]!.isEqualNode(next[i])) next[i] = current[j]!
      if (next[i] === current[j]) {
        current[j] = undefined
        if (i === j) continue outerLoop
        break
      }
    }
    insertBefore(elt, next[i], currentNode?.nextSibling || anchor)
  }
  while (current.length) current.pop()?.remove()
}

function qualifiedName(name: string): string {
  return name
    .replace(/([A-Z])/g, (match) => "-" + match[0])
    .toLowerCase()
}

function eventName(name: string): string {
  return name.startsWith("on:") ? name.slice(3) : name.slice(2).toLowerCase()
}

function objectAttribute(elt: DOMElement, field: string, object: any): void {
  for (const subField in object) {
    const value = object[subField]
    if (typeof value === "function") {
      effect<any>((subCurr) => {
        const subNext = value()
        if (subNext !== subCurr) elt[field][subField] = subNext || null
        return subNext
      })
    } else {
      elt[field][subField] = value || null
    }
  }
}

function dynamicAttribute(
  elt: DOMElement,
  field: string,
  value: () => unknown,
): void {
  effect<unknown>((current) => {
    const next = value()
    if (next !== current) attribute(elt, field, next)
    return next
  })
}

function attribute(elt: DOMElement, field: string, value: unknown): void {
  if (typeof value === "function" && !field.startsWith("on")) {
    dynamicAttribute(elt, field, value as (() => unknown))
  } else if (typeof value === "object") {
    objectAttribute(elt, field, value)
  } else if (field === "textContent") {
    if (elt.firstChild?.nodeType === 3) elt.firstChild.data = String(value)
    else elt.prepend(String(value))
  } else if (field in elt) {
    elt[field] = value
  } else if (field.startsWith("on")) {
    elt.addEventListener(eventName(field), <EventListener> value)
  } else if (value != null) {
    elt.setAttributeNS(null, qualifiedName(field), String(value))
  } else {
    elt.removeAttributeNS(null, qualifiedName(field))
  }
}

function insert(node: DOMNode): void {
  if (parentElt === undefined) parentFgt?.push(node)
  else parentElt?.appendChild(node)
}

function modify(elt: DOMElement, callback: (attributes: any) => void): void {
  const previousElt = parentElt
  const previousAttrs = parentAttrs
  parentElt = elt
  parentAttrs = callback.length ? {} : undefined
  callback(parentAttrs)
  parentElt = undefined
  if (parentAttrs) {
    for (const field in parentAttrs) {
      attribute(elt, field, parentAttrs[field])
    }
  }
  parentElt = previousElt
  parentAttrs = previousAttrs
}

type Object = { [field: string]: any }
type Accessable<T> = T | (() => T)
type AccessableObject<T> = { [Field in keyof T]: Accessable<T[Field]> }
type DOMElement = (HTMLElement | SVGElement) & { firstChild: DOMNode } & Object
type DOMNode = (Node | DOMElement) & Object
type AnyString = object & string
type BooleanLike = boolean | "false" | "true"
type NumberLike = number | string
type HTMLAttributeReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url"
  | AnyString
type HTMLInputTypeAttribute =
  | "button"
  | "checkbox"
  | "color"
  | "date"
  | "datetime-local"
  | "email"
  | "file"
  | "hidden"
  | "image"
  | "month"
  | "number"
  | "password"
  | "radio"
  | "range"
  | "reset"
  | "search"
  | "submit"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week"
  | AnyString
type AriaRole =
  | "alert"
  | "alertdialog"
  | "application"
  | "article"
  | "banner"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "complementary"
  | "contentinfo"
  | "definition"
  | "dialog"
  | "directory"
  | "document"
  | "feed"
  | "figure"
  | "form"
  | "grid"
  | "gridcell"
  | "group"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listbox"
  | "listitem"
  | "log"
  | "main"
  | "marquee"
  | "math"
  | "menu"
  | "menubar"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "navigation"
  | "none"
  | "note"
  | "option"
  | "presentation"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "region"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "scrollbar"
  | "search"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "status"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "term"
  | "textbox"
  | "timer"
  | "toolbar"
  | "tooltip"
  | "tree"
  | "treegrid"
  | "treeitem"
  | AnyString
interface HTMLElementTagNameAttributeMap {
  a: HTMLAnchorAttributes
  abbr: HTMLAbbreviationAttributes
  address: HTMLAddressAttributes
  area: HTMLAreaAttributes
  article: HTMLArticleAttributes
  aside: HTMLAsideAttributes
  audio: HTMLAudioAttributes
  b: HTMLAttentionAttributes
  base: HTMLBaseAttributes
  bdi: HTMLBidirectionalIsolateAttributes
  bdo: HTMLBidirectionalTextOverrideAttributes
  blockquote: HTMLQuoteAttributes
  body: HTMLBodyAttributes
  br: HTMLBRAttributes
  button: HTMLButtonAttributes
  canvas: HTMLCanvasAttributes
  caption: HTMLTableCaptionAttributes
  cite: HTMLCitationAttributes
  code: HTMLInlineCodeAttributes
  col: HTMLTableColAttributes
  colgroup: HTMLTableColAttributes
  data: HTMLDataAttributes
  datalist: HTMLDataListAttributes
  dd: HTMLDescriptionDetailsAttributes
  del: HTMLModAttributes
  details: HTMLDetailsAttributes
  dfn: HTMLDefinitionAttributes
  dialog: HTMLDialogAttributes
  dir: HTMLDirectoryAttributes
  div: HTMLDivAttributes
  dl: HTMLDLAttributes
  dt: HTMLDescriptionTermAttributes
  em: HTMLEmphasisAttributes
  embed: HTMLEmbedAttributes
  fieldset: HTMLFieldsetAttributes
  figcaption: HTMLFigureCaptionAttributes
  figure: HTMLFigureAttributes
  font: HTMLFontAttributes
  footer: HTMLFooterAttributes
  form: HTMLFormAttributes
  frame: HTMLFrameAttributes
  frameset: HTMLFrameSetAttributes
  h1: HTMLHeadingAttributes
  h2: HTMLHeadingAttributes
  h3: HTMLHeadingAttributes
  h4: HTMLHeadingAttributes
  h5: HTMLHeadingAttributes
  h6: HTMLHeadingAttributes
  head: HTMLHeadAttributes
  header: HTMLHeaderAttributes
  hgroup: HTMLHeadingGroupAttributes
  hr: HTMLHRAttributes
  html: HTMLHtmlAttributes
  i: HTMLIdiomaticTextAttributes
  iframe: HTMLIFrameAttributes
  img: HTMLImageAttributes
  input: HTMLInputAttributes
  ins: HTMLModAttributes
  kbd: HTMLKeyboardInputAttributes
  label: HTMLLabelAttributes
  legend: HTMLLegendAttributes
  li: HTMLLIAttributes
  link: HTMLLinkAttributes
  main: HTMLMainAttributes
  map: HTMLMapAttributes
  mark: HTMLMarkTextAttributes
  marquee: HTMLMarqueeAttributes
  menu: HTMLMenuAttributes
  meta: HTMLMetaAttributes
  meter: HTMLMeterAttributes
  nav: HTMLNavigationSectionAttributes
  noscript: HTMLNoScriptAttributes
  object: HTMLObjectAttributes
  ol: HTMLOListAttributes
  optgroup: HTMLOptGroupAttributes
  option: HTMLOptionAttributes
  output: HTMLOutputAttributes
  p: HTMLParagraphAttributes
  param: HTMLParamAttributes
  picture: HTMLPictureAttributes
  pre: HTMLPreAttributes
  progress: HTMLProgressAttributes
  q: HTMLQuoteAttributes
  rp: HTMLRubyFallbackParenthesisAttributes
  rt: HTMLRubyTextAttributes
  ruby: HTMLRubyAnnotationAttributes
  s: HTMLStrikeThroughAttributes
  samp: HTMLSampleOutputAttributes
  script: HTMLScriptAttributes
  section: HTMLGenericSectionAttributes
  select: HTMLSelectAttributes
  slot: HTMLSlotAttributes
  small: HTMLSideCommentAttributes
  source: HTMLSourceAttributes
  span: HTMLSpanAttributes
  strong: HTMLStrongImportanceAttributes
  style: HTMLStyleAttributes
  sub: HTMLSubscriptAttributes
  summary: HTMLDisclosureSummaryAttributes
  sup: HTMLSuperscriptAttributes
  table: HTMLTableAttributes
  tbody: HTMLTableSectionAttributes
  td: HTMLTableSectionAttributes<HTMLTableCellElement>
  template: HTMLHeadAttributes
  textarea: HTMLTextareaAttributes
  tfoot: HTMLTableSectionAttributes
  th: HTMLTableCellAttributes
  thead: HTMLTableSectionAttributes
  time: HTMLTimeAttributes
  title: HTMLTitleAttributes
  tr: HTMLTableRowAttributes
  track: HTMLTrackAttributes
  u: HTMLUnderlineAttributes
  ul: HTMLUListAttributes
  var: HTMLVariableAttributes
  video: HTMLVideoAttributes
  wbr: HTMLLineBreakOpportunityAttributes
}
interface SVGElementTagNameAttributeMap {
  a: SVGAttributes<SVGAElement>
  script: SVGAttributes<SVGScriptElement>
  style: SVGAttributes<SVGStyleElement>
  title: SVGAttributes<SVGTitleElement>
  animate: SVGAttributes<SVGAnimateElement>
  animateMotion: SVGAttributes<SVGAnimateMotionElement>
  animateTransform: SVGAttributes<SVGAnimateTransformElement>
  circle: SVGAttributes<SVGCircleElement>
  clipPath: SVGAttributes<SVGClipPathElement>
  defs: SVGAttributes<SVGDefsElement>
  desc: SVGAttributes<SVGDescElement>
  ellipse: SVGAttributes<SVGEllipseElement>
  feBlend: SVGAttributes<SVGFEBlendElement>
  feColorMatrix: SVGAttributes<SVGFEColorMatrixElement>
  feComponentTransfer: SVGAttributes<SVGFEComponentTransferElement>
  feComposite: SVGAttributes<SVGFECompositeElement>
  feConvolveMatrix: SVGAttributes<SVGFEConvolveMatrixElement>
  feDiffuseLighting: SVGAttributes<SVGFEDiffuseLightingElement>
  feDisplacementMap: SVGAttributes<SVGFEDisplacementMapElement>
  feDistantLight: SVGAttributes<SVGFEDistantLightElement>
  feDropShadow: SVGAttributes<SVGFEDropShadowElement>
  feFlood: SVGAttributes<SVGFEFloodElement>
  feFuncA: SVGAttributes<SVGFEFuncAElement>
  feFuncB: SVGAttributes<SVGFEFuncBElement>
  feFuncG: SVGAttributes<SVGFEFuncGElement>
  feFuncR: SVGAttributes<SVGFEFuncRElement>
  feGaussianBlur: SVGAttributes<SVGFEGaussianBlurElement>
  feImage: SVGAttributes<SVGFEImageElement>
  feMerge: SVGAttributes<SVGFEMergeElement>
  feMergeNode: SVGAttributes<SVGFEMergeNodeElement>
  feMorphology: SVGAttributes<SVGFEMorphologyElement>
  feOffset: SVGAttributes<SVGFEOffsetElement>
  fePointLight: SVGAttributes<SVGFEPointLightElement>
  feSpecularLighting: SVGAttributes<SVGFESpecularLightingElement>
  feSpotLight: SVGAttributes<SVGFESpotLightElement>
  feTile: SVGAttributes<SVGFETileElement>
  feTurbulence: SVGAttributes<SVGFETurbulenceElement>
  filter: SVGAttributes<SVGFilterElement>
  foreignObject: SVGAttributes<SVGForeignObjectElement>
  g: SVGAttributes<SVGGElement>
  image: SVGAttributes<SVGImageElement>
  line: SVGAttributes<SVGLineElement>
  linearGradient: SVGAttributes<SVGLinearGradientElement>
  marker: SVGAttributes<SVGMarkerElement>
  mask: SVGAttributes<SVGMaskElement>
  metadata: SVGAttributes<SVGMetadataElement>
  mpath: SVGAttributes<SVGMPathElement>
  path: SVGAttributes<SVGPathElement>
  pattern: SVGAttributes<SVGPatternElement>
  polygon: SVGAttributes<SVGPolygonElement>
  polyline: SVGAttributes<SVGPolylineElement>
  radialGradient: SVGAttributes<SVGRadialGradientElement>
  rect: SVGAttributes<SVGRectElement>
  set: SVGAttributes<SVGSetElement>
  stop: SVGAttributes<SVGStopElement>
  svg: SVGAttributes
  switch: SVGAttributes<SVGSwitchElement>
  symbol: SVGAttributes<SVGSymbolElement>
  text: SVGAttributes<SVGTextElement>
  textPath: SVGAttributes<SVGTextPathElement>
  tspan: SVGAttributes<SVGTSpanElement>
  use: SVGAttributes<SVGUseElement>
  view: SVGAttributes<SVGViewElement>
}
interface AriaAttributes {
  role: AriaRole
  ariaActivedescendant: string
  ariaAtomic: BooleanLike
  ariaAutocomplete: string
  ariaBusy: BooleanLike
  ariaChecked: BooleanLike | "mixed"
  ariaColcount: NumberLike
  ariaColindex: NumberLike
  ariaColspan: NumberLike
  ariaControls: string
  ariaCurrent: BooleanLike | "page" | "step" | "location" | "date" | "time"
  ariaDescribedby: string
  ariaDetails: string
  ariaDisabled: BooleanLike
  /** @deprecated */
  ariaDropeffect: "none" | "copy" | "execute" | "link" | "move" | "popup"
  ariaErrormessage: string
  ariaExpanded: BooleanLike
  ariaFlowto: string
  /** @deprecated */
  ariaGrabbed: BooleanLike
  ariaHaspopup: BooleanLike | "menu" | "listbox" | "tree" | "grid" | "dialog"
  ariaHidden: BooleanLike
  ariaInvalid: BooleanLike | "grammar" | "spelling"
  ariaKeyshortcuts: string
  ariaLabel: string
  ariaLabelledby: string
  ariaLevel: NumberLike
  ariaLive: "off" | "assertive" | "polite"
  ariaModal: BooleanLike
  ariaMultiline: BooleanLike
  ariaMultiselectable: BooleanLike
  ariaOrientation: "horizontal" | "vertical"
  ariaOwns: string
  ariaPlaceholder: string
  ariaPosinset: NumberLike
  ariaPressed: BooleanLike | "mixed"
  ariaReadonly: BooleanLike
  ariaRelevant:
    | "additions"
    | "additions removals"
    | "additions text"
    | "all"
    | "removals"
    | "removals additions"
    | "removals text"
    | "text"
    | "text additions"
    | "text removals"
  ariaRequired: BooleanLike
  ariaRoledescription: string
  ariaRowcount: NumberLike
  ariaRowindex: NumberLike
  ariaRowspan: NumberLike
  ariaSelected: BooleanLike
  ariaSetsize: NumberLike
  ariaSort: "none" | "ascending" | "descending" | "other"
  ariaValuemax: NumberLike
  ariaValuemin: NumberLike
  ariaValuenow: NumberLike
  ariaValuetext: string
  [ariaAttribute: `aria${Capitalize<string>}`]:
    | string
    | NumberLike
    | BooleanLike
    | undefined
}
interface ElementAttributes extends AccessableObject<AriaAttributes> {
  id: Accessable<string>
  autofocus: Accessable<boolean>
  nonce: Accessable<string>
  tabIndex: Accessable<number>
  contentEditable: Accessable<BooleanLike | "inherit">
  enterKeyHint: Accessable<string>
  class: Accessable<string>
  className: Accessable<string>
  slot: Accessable<string>
  innerHTML: Accessable<string>
  textContent: Accessable<string>
  lang: Accessable<string>
  inputMode: Accessable<
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search"
    | AnyString
  >
  style: AccessableObject<Styles> | Accessable<string> | Accessable<Styles>
  [unknownAttribute: string]: any
}
type EventHandler<T, E> = (event: E & { currentTarget: T }) => void
interface HTMLAttributes<T = HTMLElement>
  extends ElementAttributes, EventAttributes<T> {
  accessKey: Accessable<string>
  dir: Accessable<string>
  draggable: Accessable<BooleanLike>
  hidden: Accessable<BooleanLike>
  innerText: Accessable<string>
  lang: Accessable<string>
  spellcheck: Accessable<BooleanLike>
  title: Accessable<string>
  translate: Accessable<boolean>
  is: Accessable<string>
}
interface HTMLAnchorAttributes
  extends HTMLAttributes<HTMLAnchorElement>, HyperlinkHTMLAttributes {
  /** @deprecated */
  charset: Accessable<string>
  /** @deprecated */
  coords: Accessable<string>
  download: Accessable<string>
  hreflang: Accessable<string>
  /** @deprecated */
  name: Accessable<string>
  ping: Accessable<string>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  rel: Accessable<string>
  /** @deprecated */
  rev: Accessable<string>
  /** @deprecated */
  shape: Accessable<string>
  target: Accessable<string>
  text: Accessable<string>
  type: Accessable<string>
}
interface HTMLAreaAttributes
  extends HTMLAttributes<HTMLAreaElement>, HyperlinkHTMLAttributes {
  alt: Accessable<string>
  coords: Accessable<string>
  download: Accessable<string>
  /** @deprecated */
  noHref: Accessable<boolean>
  ping: Accessable<string>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  rel: Accessable<string>
  shape: Accessable<string>
  target: Accessable<string>
}
interface HTMLAudioAttributes extends HTMLMediaAttributes<HTMLAudioElement> {}
interface HTMLBRAttributes extends HTMLAttributes<HTMLBRElement> {
  /** @deprecated */
  clear: Accessable<string>
}
interface HTMLBaseAttributes extends HTMLAttributes<HTMLBaseElement> {
  href: Accessable<string>
  target: Accessable<string>
}
interface HTMLBodyAttributes extends HTMLAttributes<HTMLBodyElement> {
  /** @deprecated */
  aLink: Accessable<string>
  /** @deprecated */
  background: Accessable<string>
  /** @deprecated */
  bgColor: Accessable<string>
  /** @deprecated */
  link: Accessable<string>
  /** @deprecated */
  text: Accessable<string>
  /** @deprecated */
  vLink: Accessable<string>
}
interface HTMLButtonAttributes extends HTMLAttributes<HTMLButtonElement> {
  disabled: Accessable<boolean>
  formAction: Accessable<string>
  formEnctype: Accessable<string>
  formMethod: Accessable<string>
  formNoValidate: Accessable<boolean>
  formTarget: Accessable<string>
  name: Accessable<string>
  type: Accessable<string>
  value: Accessable<string>
}
interface HTMLCanvasAttributes extends HTMLAttributes<HTMLCanvasElement> {
  width: Accessable<NumberLike>
  height: Accessable<NumberLike>
}
interface HTMLDLAttributes extends HTMLAttributes<HTMLDListElement> {
  /** @deprecated */
  compact: Accessable<boolean>
}
interface HTMLDataAttributes extends HTMLAttributes<HTMLDataElement> {
  value: Accessable<string>
}
interface HTMLDataListAttributes extends HTMLAttributes<HTMLDataListElement> {}
interface HTMLDetailsAttributes extends HTMLAttributes<HTMLDetailsElement> {
  open: Accessable<boolean>
}
interface HTMLDialogAttributes extends HTMLAttributes<HTMLDialogElement> {}
interface HTMLDirectoryAttributes extends HTMLAttributes<HTMLDirectoryElement> {
  /** @deprecated */
  compact: Accessable<boolean>
}
interface HTMLDivAttributes extends HTMLAttributes<HTMLDivElement> {
  /** @deprecated */
  align: Accessable<string>
}
interface HTMLEmbedAttributes extends HTMLAttributes<HTMLEmbedElement> {
  /** @deprecated */
  align: Accessable<string>
  height: Accessable<NumberLike>
  /** @deprecated */
  name: Accessable<string>
  src: Accessable<string>
  type: Accessable<string>
  width: Accessable<NumberLike>
}
interface HTMLFieldsetAttributes extends HTMLAttributes<HTMLFieldSetElement> {
  disabled: Accessable<boolean>
  name: Accessable<string>
}
interface HTMLFontAttributes extends HTMLAttributes<HTMLFontElement> {
  /** @deprecated */
  color: Accessable<string>
  /** @deprecated */
  face: Accessable<string>
  /** @deprecated */
  size: Accessable<string>
}
interface HTMLFormAttributes extends HTMLAttributes<HTMLFormElement> {
  acceptCharset: Accessable<string>
  action: Accessable<string>
  autocomplete: Accessable<string>
  encoding: Accessable<string>
  enctype: Accessable<string>
  method: Accessable<string>
  name: Accessable<string>
  noValidate: Accessable<boolean>
  target: Accessable<string>
}
interface HTMLFrameAttributes extends HTMLAttributes<HTMLFrameElement> {
  /** @deprecated */
  frameBorder: Accessable<string>
  /** @deprecated */
  longDesc: Accessable<string>
  /** @deprecated */
  marginHeight: Accessable<string>
  /** @deprecated */
  marginWidth: Accessable<string>
  /** @deprecated */
  name: Accessable<string>
  /** @deprecated */
  noResize: Accessable<boolean>
  /** @deprecated */
  scrolling: Accessable<string>
  /** @deprecated */
  src: Accessable<string>
}
interface HTMLFrameSetAttributes extends HTMLAttributes<HTMLFrameSetElement> {
  /** @deprecated */
  cols: Accessable<NumberLike>
  /** @deprecated */
  rows: Accessable<NumberLike>
}
interface HTMLHRAttributes extends HTMLAttributes<HTMLHRElement> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  color: Accessable<string>
  /** @deprecated */
  noShade: Accessable<boolean>
  /** @deprecated */
  size: Accessable<NumberLike>
  /** @deprecated */
  width: Accessable<NumberLike>
}
interface HTMLHeadingAttributes extends HTMLAttributes<HTMLHeadingElement> {
  /** @deprecated */
  align: Accessable<string>
}
interface HTMLHeadAttributes extends HTMLAttributes<HTMLHeadElement> {}
interface HTMLHtmlAttributes extends HTMLAttributes<HTMLHtmlElement> {
  /** @deprecated */
  version: Accessable<string>
}
interface HyperlinkHTMLAttributes {
  hash: Accessable<string>
  host: Accessable<string>
  hostname: Accessable<string>
  href: Accessable<string>
  password: Accessable<string>
  pathname: Accessable<string>
  port: Accessable<string>
  protocol: Accessable<string>
  search: Accessable<string>
  username: Accessable<string>
}
interface HTMLIFrameAttributes extends HTMLAttributes<HTMLIFrameElement> {
  /** @deprecated */
  align: Accessable<string>
  allow: Accessable<string>
  allowFullscreen: Accessable<boolean>
  /** @deprecated */
  frameBorder: Accessable<string>
  height: Accessable<NumberLike>
  /** @deprecated */
  longDesc: Accessable<string>
  /** @deprecated */
  marginHeight: Accessable<NumberLike>
  /** @deprecated */
  marginWidth: Accessable<NumberLike>
  name: Accessable<string>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  scrolling: Accessable<string>
  src: Accessable<string>
  srcdoc: Accessable<string>
  width: Accessable<NumberLike>
}
interface HTMLImageAttributes extends HTMLAttributes<HTMLImageElement> {
  /** @deprecated */
  align: Accessable<string>
  alt: Accessable<string>
  /** @deprecated */
  border: Accessable<string>
  crossOrigin: Accessable<string>
  decoding: Accessable<"async" | "auto" | "sync" | AnyString>
  height: Accessable<NumberLike>
  /** @deprecated */
  hspace: Accessable<number>
  isMap: Accessable<boolean>
  loading: Accessable<string>
  /** @deprecated */
  longDesc: Accessable<string>
  /** @deprecated */
  lowscr: Accessable<string>
  /** @deprecated */
  name: Accessable<string>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  sizes: Accessable<string>
  src: Accessable<string>
  srcset: Accessable<string>
  useMap: Accessable<string>
  /** @deprecated */
  vspace: Accessable<number>
  width: Accessable<NumberLike>
}
interface HTMLInputAttributes extends HTMLAttributes<HTMLInputElement> {
  accept: Accessable<string>
  /** @deprecated */
  align: Accessable<string>
  alt: Accessable<string>
  autocomplete: Accessable<string>
  capture: Accessable<BooleanLike>
  checked: Accessable<boolean>
  defaultChecked: Accessable<boolean>
  defaultValue: Accessable<string>
  dirName: Accessable<string>
  disabled: Accessable<boolean>
  files: Accessable<FileList>
  formAction: Accessable<string>
  formEnctype: Accessable<string>
  formMethod: Accessable<string>
  formNoValidate: Accessable<boolean>
  formTarget: Accessable<string>
  height: Accessable<NumberLike>
  indeterminate: Accessable<boolean>
  max: Accessable<NumberLike>
  maxLength: Accessable<NumberLike>
  min: Accessable<NumberLike>
  minLength: Accessable<NumberLike>
  multiple: Accessable<boolean>
  name: Accessable<string>
  pattern: Accessable<string>
  placeholder: Accessable<string>
  readOnly: Accessable<boolean>
  required: Accessable<boolean>
  selectionDirection: Accessable<"forward" | "backward" | "none" | AnyString>
  selectionEnd: Accessable<number>
  selectionStart: Accessable<number>
  size: Accessable<NumberLike>
  src: Accessable<string>
  step: Accessable<NumberLike>
  type: Accessable<HTMLInputTypeAttribute>
  /** @deprecated */
  useMap: Accessable<string>
  value: Accessable<string>
  webkitdirectory: Accessable<boolean>
  width: Accessable<NumberLike>
}
interface HTMLLIAttributes extends HTMLAttributes<HTMLLIElement> {
  /** @deprecated */
  type: Accessable<string>
  value: Accessable<NumberLike>
}
interface HTMLLabelAttributes extends HTMLAttributes<HTMLLabelElement> {
  htmlFor: Accessable<string>
}
interface HTMLLegendAttributes extends HTMLAttributes<HTMLLegendElement> {
  /** @deprecated */
  align: Accessable<string>
}
interface HTMLLinkAttributes extends HTMLAttributes<HTMLLinkElement> {
  as: Accessable<string>
  /** @deprecated */
  charset: Accessable<string>
  crossOrigin: Accessable<string>
  disabled: Accessable<boolean>
  href: Accessable<string>
  hreflang: Accessable<string>
  imageSizes: Accessable<string>
  imageSrcset: Accessable<string>
  media: Accessable<string>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  rel: Accessable<string>
  rev: Accessable<string>
  /** @deprecated */
  target: Accessable<string>
  type: Accessable<string>
  sheet: Accessable<Styles>
}
interface HTMLMapAttributes extends HTMLAttributes<HTMLMapElement> {
  name: Accessable<string>
}
interface HTMLMarqueeAttributes extends HTMLAttributes<HTMLMarqueeElement> {
  /** @deprecated */
  behavior: Accessable<string>
  /** @deprecated */
  bgColor: Accessable<string>
  /** @deprecated */
  direction: Accessable<string>
  /** @deprecated */
  height: Accessable<string>
  /** @deprecated */
  hspace: Accessable<number>
  /** @deprecated */
  loop: Accessable<number>
  /** @deprecated */
  scrollAmount: Accessable<number>
  /** @deprecated */
  scrollDelay: Accessable<number>
  /** @deprecated */
  trueSpeed: boolean
  /** @deprecated */
  vspace: Accessable<number>
  /** @deprecated */
  width: Accessable<string>
}
interface HTMLMediaAttributes<T> extends HTMLAttributes<T> {
  autoplay: Accessable<boolean>
  controls: Accessable<boolean>
  crossOrigin: Accessable<string>
  currentTime: Accessable<number>
  defaultMuted: Accessable<boolean>
  defaultPlaybackRate: Accessable<number>
  loop: Accessable<boolean>
  muted: Accessable<boolean>
  playbackRate: Accessable<number>
  preload: Accessable<"none" | "metadata" | "auto" | AnyString>
  src: Accessable<string>
  srcObject: Accessable<MediaStream>
  volume: Accessable<number>
}
interface HTMLMenuAttributes extends HTMLAttributes<HTMLMenuElement> {
  /** @deprecated */
  compact: Accessable<boolean>
}
interface HTMLMetaAttributes extends HTMLAttributes<HTMLMetaElement> {
  content: Accessable<string>
  httpEquiv: Accessable<string>
  name: Accessable<string>
  /** @deprecated */
  scheme: Accessable<string>
}
interface HTMLMeterAttributes extends HTMLAttributes<HTMLMeterElement> {
  high: Accessable<NumberLike>
  low: Accessable<NumberLike>
  max: Accessable<NumberLike>
  min: Accessable<NumberLike>
  optimum: Accessable<NumberLike>
  value: Accessable<string>
}
interface HTMLModAttributes extends HTMLAttributes<HTMLModElement> {
  cite: Accessable<string>
  dateTime: Accessable<string>
}
interface HTMLOListAttributes extends HTMLAttributes<HTMLOListElement> {
  /** @deprecated */
  compact: Accessable<boolean>
  reversed: Accessable<boolean>
  start: Accessable<NumberLike>
  type: Accessable<string>
}
interface HTMLObjectAttributes extends HTMLAttributes<HTMLObjectElement> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  archive: Accessable<string>
  /** @deprecated */
  border: Accessable<string>
  /** @deprecated */
  code: Accessable<string>
  /** @deprecated */
  codeBase: Accessable<string>
  /** @deprecated */
  codeType: Accessable<string>
  data: Accessable<string>
  /** @deprecated */
  declare: Accessable<boolean>
  height: Accessable<NumberLike>
  /** @deprecated */
  hspace: Accessable<number>
  name: Accessable<string>
  /** @deprecated */
  standby: Accessable<string>
  type: Accessable<string>
  useMap: Accessable<string>
  /** @deprecated */
  vspace: Accessable<number>
  width: Accessable<NumberLike>
}
interface HTMLOptGroupAttributes extends HTMLAttributes<HTMLOptGroupElement> {
  disabled: Accessable<boolean>
  label: Accessable<string>
}
interface HTMLOptionAttributes extends HTMLAttributes<HTMLOptionElement> {
  defaultSelected: Accessable<boolean>
  disabled: Accessable<boolean>
  label: Accessable<string>
  selected: Accessable<boolean>
  text: Accessable<string>
  value: Accessable<string[] | number>
}
interface HTMLOutputAttributes extends HTMLAttributes<HTMLOutputElement> {
  defaultValue: Accessable<string>
  name: Accessable<string>
  value: Accessable<string>
}
interface HTMLParagraphAttributes extends HTMLAttributes<HTMLParagraphElement> {
  /** @deprecated */
  align: Accessable<string>
}
interface HTMLParamAttributes extends HTMLAttributes<HTMLParamElement> {
  name: Accessable<string>
  /** @deprecated */
  type: Accessable<string>
  value: Accessable<string>
  /** @deprecated */
  valueType: Accessable<string>
}
interface HTMLPreAttributes extends HTMLAttributes<HTMLPreElement> {
  /** @deprecated */
  width: Accessable<number>
}
interface HTMLProgressAttributes extends HTMLAttributes<HTMLProgressElement> {
  max: Accessable<NumberLike>
  value: Accessable<string[] | number>
}
interface HTMLQuoteAttributes extends HTMLAttributes<HTMLQuoteElement> {
  cite: Accessable<string>
}
interface HTMLScriptAttributes extends HTMLAttributes<HTMLScriptElement> {
  async: Accessable<BooleanLike>
  /** @deprecated */
  charset: Accessable<string>
  crossOrigin: Accessable<string>
  defer: Accessable<boolean>
  /** @deprecated */
  event: Accessable<string>
  /** @deprecated */
  htmlFor: Accessable<string>
  integrity: Accessable<string>
  noModule: Accessable<boolean>
  referrerPolicy: Accessable<HTMLAttributeReferrerPolicy>
  src: Accessable<string>
  text: Accessable<string>
  type: Accessable<string>
}
interface HTMLSelectAttributes extends HTMLAttributes<HTMLSelectElement> {
  autocomplete: Accessable<string>
  disabled: Accessable<boolean>
  length: Accessable<string>
  multiple: Accessable<boolean>
  name: Accessable<string>
  required: Accessable<boolean>
  selectedIndex: Accessable<number>
  size: Accessable<NumberLike>
  value: Accessable<string>
}
interface HTMLSlotAttributes extends HTMLAttributes<HTMLSlotElement> {
  name: Accessable<string>
}
interface HTMLSourceAttributes extends HTMLAttributes<HTMLSourceElement> {
  media: Accessable<string>
  sizes: Accessable<string>
  src: Accessable<string>
  srcSet: Accessable<string>
  type: Accessable<string>
}
interface HTMLStyleAttributes extends HTMLAttributes<HTMLStyleElement> {
  media: Accessable<string>
  /** @deprecated */
  type: Accessable<string>
}
interface HTMLTableCaptionAttributes
  extends HTMLAttributes<HTMLTableCaptionElement> {
  /** @deprecated */
  align: Accessable<string>
}
interface HTMLTableCellAttributes extends HTMLAttributes<HTMLTableCellElement> {
  abbr: Accessable<string>
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  axis: Accessable<string>
  /** @deprecated */
  bgColor: Accessable<string>
  /** @deprecated */
  ch: Accessable<string>
  /** @deprecated */
  chOff: Accessable<string>
  colSpan: Accessable<number>
  headers: Accessable<string>
  /** @deprecated */
  height: Accessable<NumberLike>
  /** @deprecated */
  noWrap: Accessable<boolean>
  rowSpan: Accessable<number>
  scope: Accessable<string>
  /** @deprecated */
  vAlign: Accessable<string>
  /** @deprecated */
  width: Accessable<NumberLike>
}
interface HTMLTableColAttributes extends HTMLAttributes<HTMLTableColElement> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  ch: Accessable<string>
  /** @deprecated */
  chOff: Accessable<string>
  span: Accessable<number>
  /** @deprecated */
  vAlign: Accessable<string>
  /** @deprecated */
  width: Accessable<NumberLike>
}
interface HTMLTableAttributes extends HTMLAttributes<HTMLTableElement> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  bgColor: Accessable<string>
  /** @deprecated */
  border: Accessable<string>
  /** @deprecated */
  cellPadding: Accessable<string>
  /** @deprecated */
  cellSpacing: Accessable<string>
  /** @deprecated */
  frame: Accessable<string>
  /** @deprecated */
  rules: Accessable<string>
  /** @deprecated */
  summary: Accessable<string>
  /** @deprecated */
  width: Accessable<NumberLike>
}
interface HTMLTableRowAttributes extends HTMLAttributes<HTMLTableRowElement> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  bgColor: Accessable<string>
  /** @deprecated */
  ch: Accessable<string>
  /** @deprecated */
  chOff: Accessable<string>
  /** @deprecated */
  vAlign: Accessable<string>
}
interface HTMLTableSectionAttributes<T = HTMLTableSectionElement>
  extends HTMLAttributes<T> {
  /** @deprecated */
  align: Accessable<string>
  /** @deprecated */
  ch: Accessable<string>
  /** @deprecated */
  chOff: Accessable<string>
  /** @deprecated */
  vAlign: Accessable<string>
}
interface HTMLTextareaAttributes extends HTMLAttributes<HTMLTextAreaElement> {
  autocomplete: Accessable<string>
  cols: Accessable<NumberLike>
  defaultValue: Accessable<string>
  dirName: Accessable<string>
  disabled: Accessable<boolean>
  maxLength: Accessable<NumberLike>
  minLength: Accessable<NumberLike>
  name: Accessable<string>
  placeholder: Accessable<string>
  readOnly: Accessable<boolean>
  required: Accessable<boolean>
  rows: Accessable<NumberLike>
  selectionDirection: Accessable<"forward" | "backward" | "none" | AnyString>
  selectionStart: Accessable<number>
  value: Accessable<string>
  wrap: Accessable<string>
}
interface HTMLTimeAttributes extends HTMLAttributes<HTMLTimeElement> {
  dateTime: Accessable<string>
}
interface HTMLTitleAttributes extends HTMLAttributes<HTMLTitleElement> {
  text: Accessable<string>
}
interface HTMLTrackAttributes extends HTMLAttributes<HTMLTrackElement> {
  default: Accessable<boolean>
  kind: Accessable<string>
  label: Accessable<string>
  src: Accessable<string>
  srclang: Accessable<string>
}
interface HTMLUListAttributes extends HTMLAttributes<HTMLUListElement> {
  /** @deprecated */
  compact: Accessable<boolean>
  /** @deprecated */
  type: Accessable<string>
}
interface HTMLVideoAttributes extends HTMLMediaAttributes<HTMLVideoElement> {
  disablePictureInPicture: Accessable<boolean>
  height: Accessable<NumberLike>
  playsInline: Accessable<boolean>
  poster: Accessable<string>
  width: Accessable<NumberLike>
}
interface HTMLAbbreviationAttributes extends HTMLAttributes {}
interface HTMLAddressAttributes extends HTMLAttributes {}
interface HTMLArticleAttributes extends HTMLAttributes {}
interface HTMLAsideAttributes extends HTMLAttributes {}
interface HTMLAttentionAttributes extends HTMLAttributes {}
interface HTMLBidirectionalIsolateAttributes extends HTMLAttributes {}
interface HTMLBidirectionalTextOverrideAttributes extends HTMLAttributes {}
interface HTMLCitationAttributes extends HTMLAttributes {}
interface HTMLInlineCodeAttributes extends HTMLAttributes {}
interface HTMLDescriptionDetailsAttributes extends HTMLAttributes {}
interface HTMLDefinitionAttributes extends HTMLAttributes {}
interface HTMLDescriptionTermAttributes extends HTMLAttributes {}
interface HTMLEmphasisAttributes extends HTMLAttributes {}
interface HTMLFigureCaptionAttributes extends HTMLAttributes {}
interface HTMLFigureAttributes extends HTMLAttributes {}
interface HTMLFooterAttributes extends HTMLAttributes {}
interface HTMLHeaderAttributes extends HTMLAttributes {}
interface HTMLHeadingGroupAttributes extends HTMLAttributes {}
interface HTMLIdiomaticTextAttributes extends HTMLAttributes {}
interface HTMLKeyboardInputAttributes extends HTMLAttributes {}
interface HTMLMainAttributes extends HTMLAttributes {}
interface HTMLMarkTextAttributes extends HTMLAttributes {}
interface HTMLNavigationSectionAttributes extends HTMLAttributes {}
interface HTMLNoScriptAttributes extends HTMLAttributes {}
interface HTMLRubyFallbackParenthesisAttributes extends HTMLAttributes {}
interface HTMLRubyTextAttributes extends HTMLAttributes {}
interface HTMLRubyAnnotationAttributes extends HTMLAttributes {}
interface HTMLStrikeThroughAttributes extends HTMLAttributes {}
interface HTMLSampleOutputAttributes extends HTMLAttributes {}
interface HTMLGenericSectionAttributes extends HTMLAttributes {}
interface HTMLSideCommentAttributes extends HTMLAttributes {}
interface HTMLStrongImportanceAttributes extends HTMLAttributes {}
interface HTMLSubscriptAttributes extends HTMLAttributes {}
interface HTMLDisclosureSummaryAttributes extends HTMLAttributes {}
interface HTMLSuperscriptAttributes extends HTMLAttributes {}
interface HTMLUnderlineAttributes extends HTMLAttributes {}
interface HTMLVariableAttributes extends HTMLAttributes {}
interface HTMLLineBreakOpportunityAttributes extends HTMLAttributes {}
interface HTMLPictureAttributes extends HTMLAttributes<HTMLPictureElement> {}
interface HTMLSpanAttributes extends HTMLAttributes<HTMLSpanElement> {}
interface SVGAttributes<T = SVGElement>
  extends ElementAttributes, EventAttributes<T> {
  /** @deprecated */
  "accent-height": Accessable<NumberLike>
  accumulate: Accessable<"none" | "sum">
  additive: Accessable<"replace" | "sum">
  "alignment-baseline": Accessable<
    | "auto"
    | "baseline"
    | "before-edge"
    | "text-before-edge"
    | "middle"
    | "central"
    | "after-edge"
    | "text-after-edge"
    | "ideographic"
    | "alphabetic"
    | "hanging"
    | "mathematical"
    | "top"
    | "center"
    | "bottom"
  >
  /** @deprecated */
  alphabetic: Accessable<NumberLike>
  amplitude: Accessable<NumberLike>
  /** @deprecated */
  "arabic-form": Accessable<"initial" | "medial" | "terminal" | "isolated">
  /** @deprecated */
  ascent: Accessable<NumberLike>
  attributeName: Accessable<string>
  /** @deprecated */
  attributeType: Accessable<"CSS" | "XML" | "auto">
  azimuth: Accessable<NumberLike>
  baseFrequency: Accessable<NumberLike>
  "baseline-shift": Accessable<NumberLike | "sub" | "super">
  /** @deprecated */
  baseProfile: Accessable<string>
  /** @deprecated */
  bbox: Accessable<string>
  begin: Accessable<string>
  bias: Accessable<NumberLike>
  by: Accessable<string>
  calcMode: Accessable<"discrete" | "linear" | "paced" | "spline">
  /** @deprecated */
  "cap-height": Accessable<NumberLike>
  /** @deprecated */
  clip: Accessable<string>
  "clip-path": Accessable<string>
  clipPathUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  "clip-rule": Accessable<"nonzero" | "evenodd" | "inherit">
  "color-interpolation": Accessable<"auto" | "sRGB" | "linearRGB">
  "color-interpolation-filters": Accessable<
    "auto" | "sRGB" | "linearRGB" | "inherit"
  >
  /** @deprecated */
  "color-profile": Accessable<string>
  /** @deprecated */
  "color-rendering": Accessable<"auto" | "optimizeSpeed" | "optimizeQuality">
  /** @deprecated */
  contentScriptType: Accessable<`${string}/${string}`>
  /** @deprecated */
  contentStyleType: Accessable<string>
  cursor: Accessable<string>
  cx: Accessable<NumberLike>
  cy: Accessable<NumberLike>
  d: Accessable<string>
  decelerate: Accessable<NumberLike>
  /** @deprecated */
  descent: Accessable<NumberLike>
  diffuseConstant: Accessable<"ltr" | "rtl">
  direction: Accessable<NumberLike>
  display: Accessable<string>
  divisor: Accessable<NumberLike>
  "dominant-baseline": Accessable<
    | "auto"
    | "text-bottom"
    | "alphabetic"
    | "ideographic"
    | "middle"
    | "central"
    | "mathematical"
    | "hanging"
    | "text-top"
  >
  dur: Accessable<string>
  dx: Accessable<string>
  dy: Accessable<string>
  edgeMode: Accessable<"duplicate" | "wrap" | "none">
  elevation: Accessable<NumberLike>
  /** @deprecated */
  "enable-background": Accessable<string>
  end: Accessable<string>
  exponent: Accessable<NumberLike>
  fill: Accessable<string>
  "fill-opacity": Accessable<NumberLike>
  "fill-rule": Accessable<"nonzero" | "evenodd" | "inherit">
  filter: Accessable<string>
  /** @deprecated */
  filterRes: Accessable<string>
  filterUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  "flood-color": Accessable<string>
  "flood-opacity": Accessable<NumberLike>
  "font-family": Accessable<string>
  "font-size": Accessable<NumberLike>
  "font-size-adjust": Accessable<NumberLike>
  "font-stretch": Accessable<NumberLike>
  "font-style": Accessable<"normal" | "italic" | "oblique">
  "font-variant": Accessable<string>
  "font-weight": Accessable<
    NumberLike | "normal" | "bold" | "bolder" | "lighter"
  >
  /** @deprecated */
  format: Accessable<string>
  fr: Accessable<NumberLike>
  from: Accessable<NumberLike>
  fx: Accessable<NumberLike>
  fy: Accessable<NumberLike>
  /** @deprecated */
  g1: Accessable<string>
  /** @deprecated */
  g2: Accessable<string>
  /** @deprecated */
  "glyph-name": Accessable<string>
  /** @deprecated */
  "glyph-orientation-horizontal": Accessable<NumberLike>
  /** @deprecated */
  "glyph-orientation-vertical": Accessable<NumberLike>
  /** @deprecated */
  glyphRef: Accessable<NumberLike>
  gradientTransform: Accessable<string>
  gradientUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  /** @deprecated */
  hanging: Accessable<NumberLike>
  height: Accessable<NumberLike>
  /** @deprecated */
  "horiz-adv-x": Accessable<NumberLike>
  /** @deprecated */
  "horiz-origin-x": Accessable<NumberLike>
  /** @deprecated */
  ideographic: Accessable<NumberLike>
  "image-rendering": Accessable<"auto" | "optimizeSpeed" | "optimizeQuality">
  in2: Accessable<NumberLike>
  in: Accessable<string>
  intercept: Accessable<NumberLike>
  k1: Accessable<NumberLike>
  k2: Accessable<NumberLike>
  k3: Accessable<NumberLike>
  k4: Accessable<NumberLike>
  /** @deprecated */
  k: Accessable<NumberLike>
  kernelMatrix: Accessable<NumberLike>
  /** @deprecated */
  kernelUnitLength: Accessable<NumberLike>
  /** @deprecated */
  kerning: Accessable<NumberLike | "auto">
  keyPoints: Accessable<NumberLike>
  keySplines: Accessable<NumberLike>
  keyTimes: Accessable<NumberLike>
  lengthAdjust: Accessable<"spacing" | "spacingAndGlyphs">
  "letter-spacing": Accessable<NumberLike | "normal">
  "lighting-color": Accessable<string>
  limitingConeAngle: Accessable<NumberLike>
  "marker-end": Accessable<`url(#${string})`>
  markerHeight: Accessable<NumberLike>
  "marker-mid": Accessable<`url(#${string})`>
  "marker-start": Accessable<`url(#${string})`>
  markerUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  markerWidth: Accessable<NumberLike>
  mask: Accessable<string>
  maskContentUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  maskUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  /** @deprecated */
  mathematical: Accessable<NumberLike>
  media: Accessable<string>
  /** @experimental */
  method: Accessable<"align" | "stretch">
  mode: Accessable<string>
  /** @deprecated */
  name: Accessable<string>
  numOctaves: Accessable<NumberLike>
  offset: Accessable<NumberLike>
  opacity: Accessable<NumberLike>
  operator: Accessable<
    | "over"
    | "in"
    | "out"
    | "atop"
    | "xor"
    | "lighter"
    | "arithmetic"
    | "erode"
    | "dilate"
  >
  order: Accessable<NumberLike>
  orient: Accessable<NumberLike | "auto" | "auto-start-reverse">
  /** @deprecated */
  orientation: Accessable<"h" | "v">
  origin: Accessable<"default">
  overflow: Accessable<"visible" | "hidden" | "scroll" | "auto">
  "overline-position": Accessable<NumberLike>
  "overline-thickness": Accessable<NumberLike>
  "paint-order": Accessable<"normal" | "fill" | "stroke" | "markers">
  /** @deprecated */
  "panose-1": Accessable<NumberLike>
  path: Accessable<string>
  pathLength: Accessable<NumberLike>
  patternContentUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  patternTransform: Accessable<NumberLike>
  patternUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  "pointer-events": Accessable<
    | "bounding-box"
    | "visiblePainted"
    | "visibleFill"
    | "visibleStroke"
    | "visible"
    | "painted"
    | "fill"
    | "stroke"
    | "all"
    | "none"
  >
  points: Accessable<string>
  pointsAtX: Accessable<NumberLike>
  pointsAtY: Accessable<NumberLike>
  pointsAtZ: Accessable<NumberLike>
  preserveAlpha: Accessable<BooleanLike>
  preserveAspectRatio: Accessable<string>
  primitiveUnits: Accessable<"userSpaceOnUse" | "objectBoundingBox">
  r: Accessable<NumberLike>
  radius: Accessable<NumberLike>
  refX: Accessable<NumberLike>
  refY: Accessable<NumberLike>
  "rendering-intent": Accessable<NumberLike>
  repeatCount: Accessable<NumberLike | "indefinite">
  repeatDur: Accessable<NumberLike | "indefinite">
  requiredExtensions: Accessable<NumberLike>
  /** @deprecated */
  requiredFeatures: Accessable<NumberLike>
  restart: Accessable<"always" | "whenNotActive" | "never">
  result: Accessable<string>
  rotate: Accessable<NumberLike | "auto" | "auto-reverse">
  rx: Accessable<NumberLike>
  ry: Accessable<NumberLike>
  scale: Accessable<NumberLike>
  seed: Accessable<NumberLike>
  "shape-rendering": Accessable<
    "auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision"
  >
  /** @deprecated */
  slope: Accessable<NumberLike>
  spacing: Accessable<"auto" | "exact">
  specularConstant: Accessable<NumberLike>
  specularExponent: Accessable<NumberLike>
  speed: Accessable<NumberLike>
  spreadMethod: Accessable<"pad" | "reflect" | "repeat">
  startOffset: Accessable<NumberLike>
  stdDeviation: Accessable<NumberLike>
  /** @deprecated */
  stemh: Accessable<NumberLike>
  /** @deprecated */
  stemv: Accessable<NumberLike>
  stitchTiles: Accessable<"noStitch" | "stitch">
  "stop-color": Accessable<string>
  "stop-opacity": Accessable<NumberLike>
  "strikethrough-position": Accessable<NumberLike>
  "strikethrough-thickness": Accessable<NumberLike>
  /** @deprecated */
  string: Accessable<NumberLike>
  stroke: Accessable<string>
  "stroke-dasharray": Accessable<NumberLike>
  "stroke-dashoffset": Accessable<NumberLike>
  "stroke-linecap": Accessable<"butt" | "round" | "square" | "inherit">
  "stroke-linejoin": Accessable<"miter" | "round" | "bevel" | "inherit">
  "stroke-miterlimit": Accessable<NumberLike>
  "stroke-opacity": Accessable<NumberLike>
  "stroke-width": Accessable<NumberLike>
  surfaceScale: Accessable<NumberLike>
  systemLanguage: Accessable<NumberLike>
  tableValues: Accessable<NumberLike>
  targetX: Accessable<NumberLike>
  targetY: Accessable<NumberLike>
  "text-anchor": Accessable<"start" | "middle" | "end">
  "text-decoration": Accessable<string>
  textLength: Accessable<NumberLike>
  "text-rendering": Accessable<NumberLike>
  to: Accessable<NumberLike>
  transform: Accessable<string>
  "transform-origin": Accessable<string>
  type: Accessable<
    | "translate"
    | "scale"
    | "rotate"
    | "skewX"
    | "skewY"
    | "matrix"
    | "saturate"
    | "hueRotate"
    | "luminanceToAlpha"
    | "identity"
    | "table"
    | "discrete"
    | "linear"
    | "gamma"
    | "fractalNoise"
    | "turbulence"
  >
  /** @deprecated */
  u1: Accessable<string>
  /** @deprecated */
  u2: Accessable<string>
  "underline-position": Accessable<NumberLike>
  "underline-thickness": Accessable<NumberLike>
  /** @deprecated */
  unicode: Accessable<string>
  "unicode-bidi": Accessable<
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext"
  >
  /** @deprecated */
  "unicode-range": Accessable<string>
  /** @deprecated */
  "units-per-em": Accessable<NumberLike>
  /** @deprecated */
  "v-alphabetic": Accessable<NumberLike>
  values: Accessable<string>
  "vector-effect": Accessable<
    | "none"
    | "non-scaling-stroke"
    | "non-scaling-size"
    | "non-rotation"
    | "fixed-position"
  >
  /** @deprecated */
  version: Accessable<string>
  /** @deprecated */
  "vert-adv-y": Accessable<NumberLike>
  /** @deprecated */
  "vert-origin-x": Accessable<NumberLike>
  /** @deprecated */
  "vert-origin-y": Accessable<NumberLike>
  /** @deprecated */
  "v-hanging": Accessable<NumberLike>
  /** @deprecated */
  "v-ideographic": Accessable<NumberLike>
  viewBox: Accessable<string>
  /** @deprecated */
  viewTarget: Accessable<NumberLike>
  visibility: Accessable<"visible" | "hidden" | "collapse">
  /** @deprecated */
  "v-mathematical": Accessable<NumberLike>
  width: Accessable<NumberLike>
  /** @deprecated */
  widths: Accessable<NumberLike>
  "word-spacing": Accessable<NumberLike>
  "writing-mode": Accessable<NumberLike>
  x1: Accessable<NumberLike>
  x2: Accessable<NumberLike>
  x: Accessable<NumberLike>
  xChannelSelector: Accessable<"R" | "G" | "B" | "A">
  /** @deprecated */
  "x-height": Accessable<NumberLike>
  /** @deprecated */
  "xlink:actuate": Accessable<string>
  /** @deprecated */
  "xlink:arcrole": Accessable<string>
  /** @deprecated */
  "xlink:href": Accessable<string>
  /** @deprecated */
  "xlink:role": Accessable<string>
  /** @deprecated */
  "xlink:show": Accessable<"new" | "replace" | "embed" | "other" | "none">
  /** @deprecated */
  "xlink:title": Accessable<string>
  /** @deprecated */
  "xlink:type": Accessable<"simple">
  /** @deprecated */
  "xml:base": Accessable<string>
  "xml:lang": Accessable<string>
  /** @deprecated */
  "xml:space": Accessable<"default" | "preserve">
  y1: Accessable<NumberLike>
  y2: Accessable<NumberLike>
  y: Accessable<NumberLike>
  yChannelSelector: Accessable<"R" | "G" | "B" | "A">
  z: Accessable<NumberLike>
  /** @deprecated */
  zoomAndPan: Accessable<"disable" | "magnify">
}
interface Styles {
  accentColor?: string
  alignContent?: string
  alignItems?: string
  alignSelf?: string
  alignmentBaseline?: string
  all?: string
  animation?: string
  animationDelay?: string
  animationDirection?: string
  animationDuration?: string
  animationFillMode?: string
  animationIterationCount?: string
  animationName?: string
  animationPlayState?: string
  animationTimingFunction?: string
  appearance?: string
  aspectRatio?: string
  backfaceVisibility?: string
  background?: string
  backgroundAttachment?: string
  backgroundBlendMode?: string
  backgroundClip?: string
  backgroundColor?: string
  backgroundImage?: string
  backgroundOrigin?: string
  backgroundPosition?: string
  backgroundPositionX?: string
  backgroundPositionY?: string
  backgroundRepeat?: string
  backgroundSize?: string
  baselineShift?: string
  blockSize?: string
  border?: string
  borderBlock?: string
  borderBlockColor?: string
  borderBlockEnd?: string
  borderBlockEndColor?: string
  borderBlockEndStyle?: string
  borderBlockEndWidth?: string
  borderBlockStart?: string
  borderBlockStartColor?: string
  borderBlockStartStyle?: string
  borderBlockStartWidth?: string
  borderBlockStyle?: string
  borderBlockWidth?: string
  borderBottom?: string
  borderBottomColor?: string
  borderBottomLeftRadius?: string
  borderBottomRightRadius?: string
  borderBottomStyle?: string
  borderBottomWidth?: string
  borderCollapse?: string
  borderColor?: string
  borderEndEndRadius?: string
  borderEndStartRadius?: string
  borderImage?: string
  borderImageOutset?: string
  borderImageRepeat?: string
  borderImageSlice?: string
  borderImageSource?: string
  borderImageWidth?: string
  borderInline?: string
  borderInlineColor?: string
  borderInlineEnd?: string
  borderInlineEndColor?: string
  borderInlineEndStyle?: string
  borderInlineEndWidth?: string
  borderInlineStart?: string
  borderInlineStartColor?: string
  borderInlineStartStyle?: string
  borderInlineStartWidth?: string
  borderInlineStyle?: string
  borderInlineWidth?: string
  borderLeft?: string
  borderLeftColor?: string
  borderLeftStyle?: string
  borderLeftWidth?: string
  borderRadius?: string
  borderRight?: string
  borderRightColor?: string
  borderRightStyle?: string
  borderRightWidth?: string
  borderSpacing?: string
  borderStartEndRadius?: string
  borderStartStartRadius?: string
  borderStyle?: string
  borderTop?: string
  borderTopColor?: string
  borderTopLeftRadius?: string
  borderTopRightRadius?: string
  borderTopStyle?: string
  borderTopWidth?: string
  borderWidth?: string
  bottom?: string
  boxShadow?: string
  boxSizing?: string
  breakAfter?: string
  breakBefore?: string
  breakInside?: string
  captionSide?: string
  caretColor?: string
  clear?: string
  /** @deprecated */
  clip?: string
  clipPath?: string
  clipRule?: string
  color?: string
  colorInterpolation?: string
  colorInterpolationFilters?: string
  colorScheme?: string
  columnCount?: string
  columnFill?: string
  columnGap?: string
  columnRule?: string
  columnRuleColor?: string
  columnRuleStyle?: string
  columnRuleWidth?: string
  columnSpan?: string
  columnWidth?: string
  columns?: string
  contain?: string
  content?: string
  counterIncrement?: string
  counterReset?: string
  counterSet?: string
  cssFloat?: string
  cssText?: string
  cursor?: string
  direction?: string
  display?: string
  dominantBaseline?: string
  emptyCells?: string
  fill?: string
  fillOpacity?: string
  fillRule?: string
  filter?: string
  flex?: string
  flexBasis?: string
  flexDirection?: string
  flexFlow?: string
  flexGrow?: string
  flexShrink?: string
  flexWrap?: string
  float?: string
  floodColor?: string
  floodOpacity?: string
  font?: string
  fontFamily?: string
  fontFeatureSettings?: string
  fontKerning?: string
  fontOpticalSizing?: string
  fontSize?: string
  fontSizeAdjust?: string
  fontStretch?: string
  fontStyle?: string
  fontSynthesis?: string
  fontVariant?: string
  /** @deprecated */
  fontVariantAlternates?: string
  fontVariantCaps?: string
  fontVariantEastAsian?: string
  fontVariantLigatures?: string
  fontVariantNumeric?: string
  fontVariantPosition?: string
  fontVariationSettings?: string
  fontWeight?: string
  gap?: string
  grid?: string
  gridArea?: string
  gridAutoColumns?: string
  gridAutoFlow?: string
  gridAutoRows?: string
  gridColumn?: string
  gridColumnEnd?: string
  /** @deprecated */
  gridColumnGap?: string
  gridColumnStart?: string
  /** @deprecated */
  gridGap?: string
  gridRow?: string
  gridRowEnd?: string
  /** @deprecated */
  gridRowGap?: string
  gridRowStart?: string
  gridTemplate?: string
  gridTemplateAreas?: string
  gridTemplateColumns?: string
  gridTemplateRows?: string
  height?: string
  hyphens?: string
  /** @deprecated */
  imageOrientation?: string
  imageRendering?: string
  inlineSize?: string
  inset?: string
  insetBlock?: string
  insetBlockEnd?: string
  insetBlockStart?: string
  insetInline?: string
  insetInlineEnd?: string
  insetInlineStart?: string
  isolation?: string
  justifyContent?: string
  justifyItems?: string
  justifySelf?: string
  left?: string
  letterSpacing?: string
  lightingColor?: string
  lineBreak?: string
  lineHeight?: string
  listStyle?: string
  listStyleImage?: string
  listStylePosition?: string
  listStyleType?: string
  margin?: string
  marginBlock?: string
  marginBlockEnd?: string
  marginBlockStart?: string
  marginBottom?: string
  marginInline?: string
  marginInlineEnd?: string
  marginInlineStart?: string
  marginLeft?: string
  marginRight?: string
  marginTop?: string
  marker?: string
  markerEnd?: string
  markerMid?: string
  markerStart?: string
  mask?: string
  maskType?: string
  maxBlockSize?: string
  maxHeight?: string
  maxInlineSize?: string
  maxWidth?: string
  minBlockSize?: string
  minHeight?: string
  minInlineSize?: string
  minWidth?: string
  mixBlendMode?: string
  objectFit?: string
  objectPosition?: string
  offset?: string
  offsetAnchor?: string
  offsetDistance?: string
  offsetPath?: string
  offsetRotate?: string
  opacity?: string
  order?: string
  orphans?: string
  outline?: string
  outlineColor?: string
  outlineOffset?: string
  outlineStyle?: string
  outlineWidth?: string
  overflow?: string
  overflowAnchor?: string
  overflowWrap?: string
  overflowX?: string
  overflowY?: string
  overscrollBehavior?: string
  overscrollBehaviorBlock?: string
  overscrollBehaviorInline?: string
  overscrollBehaviorX?: string
  overscrollBehaviorY?: string
  padding?: string
  paddingBlock?: string
  paddingBlockEnd?: string
  paddingBlockStart?: string
  paddingBottom?: string
  paddingInline?: string
  paddingInlineEnd?: string
  paddingInlineStart?: string
  paddingLeft?: string
  paddingRight?: string
  paddingTop?: string
  pageBreakAfter?: string
  pageBreakBefore?: string
  pageBreakInside?: string
  paintOrder?: string
  perspective?: string
  perspectiveOrigin?: string
  placeContent?: string
  placeItems?: string
  placeSelf?: string
  pointerEvents?: string
  position?: string
  quotes?: string
  resize?: string
  right?: string
  rotate?: string
  rowGap?: string
  rubyPosition?: string
  scale?: string
  scrollBehavior?: string
  scrollMargin?: string
  scrollMarginBlock?: string
  scrollMarginBlockEnd?: string
  scrollMarginBlockStart?: string
  scrollMarginBottom?: string
  scrollMarginInline?: string
  scrollMarginInlineEnd?: string
  scrollMarginInlineStart?: string
  scrollMarginLeft?: string
  scrollMarginRight?: string
  scrollMarginTop?: string
  scrollPadding?: string
  scrollPaddingBlock?: string
  scrollPaddingBlockEnd?: string
  scrollPaddingBlockStart?: string
  scrollPaddingBottom?: string
  scrollPaddingInline?: string
  scrollPaddingInlineEnd?: string
  scrollPaddingInlineStart?: string
  scrollPaddingLeft?: string
  scrollPaddingRight?: string
  scrollPaddingTop?: string
  scrollSnapAlign?: string
  scrollSnapStop?: string
  scrollSnapType?: string
  shapeImageThreshold?: string
  shapeMargin?: string
  shapeOutside?: string
  shapeRendering?: string
  stopColor?: string
  stopOpacity?: string
  stroke?: string
  strokeDasharray?: string
  strokeDashoffset?: string
  strokeLinecap?: string
  strokeLinejoin?: string
  strokeMiterlimit?: string
  strokeOpacity?: string
  strokeWidth?: string
  tabSize?: string
  tableLayout?: string
  textAlign?: string
  textAlignLast?: string
  textAnchor?: string
  textCombineUpright?: string
  textDecoration?: string
  textDecorationColor?: string
  textDecorationLine?: string
  textDecorationSkipInk?: string
  textDecorationStyle?: string
  textDecorationThickness?: string
  textEmphasis?: string
  textEmphasisColor?: string
  textEmphasisPosition?: string
  textEmphasisStyle?: string
  textIndent?: string
  textOrientation?: string
  textOverflow?: string
  textRendering?: string
  textShadow?: string
  textTransform?: string
  textUnderlineOffset?: string
  textUnderlinePosition?: string
  top?: string
  touchAction?: string
  transform?: string
  transformBox?: string
  transformOrigin?: string
  transformStyle?: string
  transition?: string
  transitionDelay?: string
  transitionDuration?: string
  transitionProperty?: string
  transitionTimingFunction?: string
  translate?: string
  unicodeBidi?: string
  userSelect?: string
  verticalAlign?: string
  visibility?: string
  whiteSpace?: string
  widows?: string
  width?: string
  willChange?: string
  wordBreak?: string
  wordSpacing?: string
  /** @deprecated */
  wordWrap?: string
  writingMode?: string
  zIndex?: string
  [field: string]: string | undefined
}
type OnPrefixedEventAttributes<T, E> = {
  [eventName: `on:${string}`]: EventHandler<T, E>
}
interface EventAttributes<T> extends OnPrefixedEventAttributes<T, Event> {
  onAbort: EventHandler<T, UIEvent>
  onAnimationCancel: EventHandler<T, AnimationEvent>
  onAnimationEnd: EventHandler<T, AnimationEvent>
  onAnimationIteration: EventHandler<T, AnimationEvent>
  onAnimationStart: EventHandler<T, AnimationEvent>
  onAuxClick: EventHandler<T, MouseEvent>
  onBeforeInput: EventHandler<T, InputEvent>
  onBlur: EventHandler<T, FocusEvent>
  onCanPlay: EventHandler<T, Event>
  onCanPlayThrough: EventHandler<T, Event>
  onChange: EventHandler<T, Event>
  onClick: EventHandler<T, MouseEvent>
  onClose: EventHandler<T, Event>
  onCompositionEnd: EventHandler<T, CompositionEvent>
  onCompositionStart: EventHandler<T, CompositionEvent>
  onCompositionUpdate: EventHandler<T, CompositionEvent>
  onContextMenu: EventHandler<T, MouseEvent>
  onCopy: EventHandler<T, ClipboardEvent>
  onCueChange: EventHandler<T, Event>
  onCut: EventHandler<T, ClipboardEvent>
  onDblClick: EventHandler<T, MouseEvent>
  onDrag: EventHandler<T, DragEvent>
  onDragEnd: EventHandler<T, DragEvent>
  onDragEnter: EventHandler<T, DragEvent>
  onDragLeave: EventHandler<T, DragEvent>
  onDragOver: EventHandler<T, DragEvent>
  onDragStart: EventHandler<T, DragEvent>
  onDrop: EventHandler<T, DragEvent>
  onDurationChange: EventHandler<T, Event>
  onEmptied: EventHandler<T, Event>
  onEnded: EventHandler<T, Event>
  onError: EventHandler<T, ErrorEvent>
  onFocus: EventHandler<T, FocusEvent>
  onFocusIn: EventHandler<T, FocusEvent>
  onFocusOut: EventHandler<T, FocusEvent>
  onFormData: EventHandler<T, FormDataEvent>
  onGotPointerCapture: EventHandler<T, PointerEvent>
  onInput: EventHandler<T, Event>
  onInvalid: EventHandler<T, Event>
  onKeyDown: EventHandler<T, KeyboardEvent>
  onKeyPress: EventHandler<T, KeyboardEvent>
  onKeyUp: EventHandler<T, KeyboardEvent>
  onLoad: EventHandler<T, Event>
  onLoadedData: EventHandler<T, Event>
  onLoadedMetadata: EventHandler<T, Event>
  onLoadStart: EventHandler<T, Event>
  onLostPointerCapture: EventHandler<T, PointerEvent>
  onMouseDown: EventHandler<T, MouseEvent>
  onMouseEnter: EventHandler<T, MouseEvent>
  onMouseLeave: EventHandler<T, MouseEvent>
  onMouseMove: EventHandler<T, MouseEvent>
  onMouseOut: EventHandler<T, MouseEvent>
  onMouseOver: EventHandler<T, MouseEvent>
  onMouseUp: EventHandler<T, MouseEvent>
  onPause: EventHandler<T, Event>
  onPaste: EventHandler<T, ClipboardEvent>
  onPlay: EventHandler<T, Event>
  onPlaying: EventHandler<T, Event>
  onPointerCancel: EventHandler<T, PointerEvent>
  onPointerDown: EventHandler<T, PointerEvent>
  onPointerEnter: EventHandler<T, PointerEvent>
  onPointerLeave: EventHandler<T, PointerEvent>
  onPointerMove: EventHandler<T, PointerEvent>
  onPointerOut: EventHandler<T, PointerEvent>
  onPointerOver: EventHandler<T, PointerEvent>
  onPointerUp: EventHandler<T, PointerEvent>
  onProgress: EventHandler<T, ProgressEvent>
  onRateChange: EventHandler<T, Event>
  onReset: EventHandler<T, Event>
  onResize: EventHandler<T, UIEvent>
  onScroll: EventHandler<T, Event>
  onSecurityPolicyViolation: EventHandler<
    T,
    SecurityPolicyViolationEvent
  >
  onSeeked: EventHandler<T, Event>
  onSeeking: EventHandler<T, Event>
  onSelect: EventHandler<T, Event>
  onSelectionChange: EventHandler<T, Event>
  onSelectStart: EventHandler<T, Event>
  onStalled: EventHandler<T, Event>
  onSubmit: EventHandler<T, Event>
  onSuspend: EventHandler<T, Event>
  onTimeUpdate: EventHandler<T, Event>
  onToggle: EventHandler<T, Event>
  onTouchCancel: EventHandler<T, TouchEvent>
  onTouchEnd: EventHandler<T, TouchEvent>
  onTouchMove: EventHandler<T, TouchEvent>
  onTouchStart: EventHandler<T, TouchEvent>
  onTransitionCancel: EventHandler<T, TransitionEvent>
  onTransitionEnd: EventHandler<T, TransitionEvent>
  onTransitionRun: EventHandler<T, TransitionEvent>
  onTransitionStart: EventHandler<T, TransitionEvent>
  onVolumeChange: EventHandler<T, Event>
  onWaiting: EventHandler<T, Event>
  onWebkitAnimationEnd: EventHandler<T, Event>
  onWebkitAnimationIteration: EventHandler<T, Event>
  onWebkitAnimationStart: EventHandler<T, Event>
  onWebkitTransitionEnd: EventHandler<T, Event>
  onWheel: EventHandler<T, WheelEvent>
}
