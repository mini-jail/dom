import {
  Accessor,
  Cleanup,
  cleanup,
  effect,
  mount,
  root,
} from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"

export type DOMNode =
  & (Node | HTMLElement | SVGElement | ParentNode | ChildNode)
  & Record<string, any>
export type Attributes = Record<string, any>
export type HTMLElementOptionMap = {
  [TagName in keyof HTMLElementTagNameMap]: ElementCallback<Attributes>
}
export type ElementCallback<T = void> = T extends void ? (() => void)
  : ((attributes: Attributes) => void)

let parentFgt: DOMNode[] | undefined
let parentElt: HTMLElement | SVGElement | undefined

export function elRef(): HTMLElement | undefined
export function elRef<T extends HTMLElement>(): T | undefined
export function elRef<T extends SVGElement>(): T | undefined
export function elRef(): HTMLElement | SVGElement | undefined {
  return parentElt
}

export function addElement<T extends keyof HTMLElementOptionMap>(
  tagName: T,
  options?: HTMLElementOptionMap[T],
): void {
  const elt = document.createElement(tagName)
  if (options) modify(elt, options)
  if (parentElt || parentFgt) insert(elt)
}

export function addText(value: string | Accessor<string>): void {
  const node = new Text()
  if (typeof value === "function") {
    effect((current: string | undefined) => {
      const next = value()
      if (next !== current) node.data = next
      return next
    })
  } else {
    node.data = value
  }
  insert(node)
}

export function addEvent<
  E extends keyof GlobalEventHandlersEventMap,
>(
  type: E,
  callback: (
    event: GlobalEventHandlersEventMap[E] & {
      currentTarget: HTMLElement & EventTarget
    },
  ) => void,
): void {
  const elt = parentElt
  if (elt === undefined) return
  mount(() => elt.addEventListener(type, callback as EventListener))
  cleanup(() => elt.removeEventListener(type, callback as EventListener))
}

export function setAttribute(
  name: string,
  value: string | Accessor<string>,
): void {
  const elt = parentElt
  if (elt === undefined) return
  const qualifiedName = name.replace("A-Z", "-$1".toLocaleLowerCase())
  if (typeof value === "function") {
    effect(() => elt.setAttribute(qualifiedName, value()))
  } else {
    elt.setAttribute(qualifiedName, value)
  }
}

export function render(
  rootElt: HTMLElement,
  callback: ElementCallback,
): Cleanup {
  return root((cleanup) => {
    effect(() => modify(rootElt, callback))
    return cleanup
  })!
}

export function component<T extends (...args: any[]) => any>(
  callback: T,
): (...args: Parameters<T>) => ReturnType<T> {
  return ((...args) => root(() => callback(...args)))
}

function union(elt: DOMNode, next: DOMNode[]) {
  const current: (DOMNode | undefined)[] = Array.from(elt.childNodes)
  const currentLength = current.length
  const nextLength = next.length
  let currentNode: DOMNode | undefined = undefined
  let i: number, j: number
  outerLoop:
  for (i = 0; i < nextLength; i++) {
    currentNode = current[i]
    for (j = 0; j < currentLength; j++) {
      if (current[j] === undefined) continue
      if (current[j]!.nodeType === 3 && next[i].nodeType === 3) {
        if (current[j]!.data !== next[i].data) {
          current[j]!.data = next[i].data
        }
        next[i] = current[j]!
      } else if (current[j]!.isEqualNode(next[i])) {
        next[i] = current[j]!
      }
      if (next[i] === current[j]) {
        current[j] = undefined
        if (i === j) continue outerLoop
        break
      }
    }
    elt?.insertBefore(next[i], currentNode?.nextSibling || null)
  }
  while (current.length) current.pop()?.remove()
}

function attributes(
  elt: DOMNode,
  current?: Attributes,
  next?: Attributes,
) {
  if (next !== undefined) {
    if (current) {
      for (const field in current) {
        if (next[field] === undefined) {
          elt[field] = null
        }
      }
    }
    for (const field in next) {
      if (current === undefined || current[field] !== next[field]) {
        elt[field] = next[field]
      }
    }
  }
}

function insert(node: DOMNode): void {
  if (parentElt === undefined) parentFgt?.push(node)
  parentElt?.appendChild(node)
}

function modify(elt: HTMLElement, options: (attr: any) => void) {
  effect((current?: Attributes) => {
    const next: Attributes | undefined = options.length ? {} : undefined
    const previousElt = parentElt
    const previousFgt = parentFgt
    const nextFgt: any[] = parentFgt = []
    parentElt = elt
    options(next)
    parentElt = previousElt
    if (current || next) {
      attributes(elt, current, next)
    }
    if (nextFgt.length) {
      union(elt, nextFgt)
      parentFgt = previousFgt
    }
    return next
  })
}
