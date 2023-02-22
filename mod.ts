import {
  Accessor,
  Cleanup,
  cleanup,
  effect,
  mount,
  root,
} from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"

// little workaround, i don't have a console on my tablet. lol
const logEl = document.createElement("div")
logEl.style.padding = "8px"
logEl.style.backgroundColor = "black"
logEl.style.color = "white"
logEl.style.borderRadius = "8px"
logEl.style.margin = "8px"
logEl.style.position = "sticky"
logEl.style.bottom = "0px"
logEl.style.left = "0px"
logEl.onclick = () => logEl.textContent = ""
document.body.appendChild(logEl)
console.log = (...data: any[]) => {
  logEl.appendChild(new Text(data.map((data) => String(data)).join(" ")))
  logEl.appendChild(document.createElement("br"))
}
onerror = (error) => console.log(String(error))

export type HTMLElementOptionMap = {
  [TagName in keyof HTMLElementTagNameMap]: ElementCallback<Record<string, any>>
}

export type ElementCallback<T = void> = T extends void ? (() => void)
  : ((attributes: any) => void)

let parentFgt: (Node | HTMLElement | ParentNode | ChildNode)[] | undefined
let parentElt: HTMLElement | undefined

export function elRef(): HTMLElement | undefined
export function elRef<T extends HTMLElement>(): T | undefined
export function elRef(): HTMLElement | undefined {
  return parentElt
}

export function addElement<T extends keyof HTMLElementOptionMap>(
  tagName: T,
  options?: HTMLElementOptionMap[T],
): void {
  const previousElt = parentElt
  const elt = document.createElement(tagName)
  if (options) {
    // @ts-ignore: need to check why?
    effect<Record<string, any> | undefined>((currentAttributes) => {
      const previousElt = parentElt
      const previousFgt = parentFgt
      parentElt = elt
      const nextAttributes: Record<string, any> | undefined = options.length
        ? {}
        : undefined
      options(nextAttributes)
      if (nextAttributes !== undefined) {
        for (const field in nextAttributes) {
          if (
            currentAttributes === undefined ||
            currentAttributes[field] !== nextAttributes[field]
          ) {
            elt[field as keyof typeof elt] = nextAttributes[field]
          }
        }
      }
      const nextFgt: any[] = []
      parentFgt = nextFgt
      union(elt, nextFgt)
      parentFgt = previousFgt
      parentElt = previousElt
      return nextAttributes
    })
  }
  if (parentFgt && parentElt === undefined) parentFgt.push(elt)
  else parentElt?.appendChild(elt)
  parentElt = previousElt
}

export function addText(value: string | Accessor<string>): void {
  const node = new Text()
  if (typeof value === "function") {
    effect<string>((previous) => {
      const next = value()
      console.log("previous:", previous, "next:", next)
      if (next !== previous) node.data = next
      return next
    })
  } else {
    node.data = value
  }
  if (parentFgt && parentElt === undefined) parentFgt.push(node)
  else parentElt?.appendChild(node)
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
  mount(() => {
    console.log("listen", type)
    elt?.addEventListener(type, callback as EventListener)
  })
  cleanup(() => {
    console.log("unlisten", type)
    elt?.removeEventListener(type, callback as EventListener)
  })
}

export function render(
  rootElt: HTMLElement,
  callback: ElementCallback,
): Cleanup {
  return root((cleanup) => {
    const previousElt = parentElt
    parentElt = rootElt
    callback()
    parentElt = previousElt
    return cleanup
  })!
}

export function component<T extends (...args: any[]) => any>(
  callback: T,
): (...args: Parameters<T>) => ReturnType<T> {
  return ((...args: any[]): any => root(() => callback(...args)))
}

function union(elt: HTMLElement, next: any[]) {
  const current: any[] = Array.from(elt.childNodes)
  let currentNode: ChildNode | null = null
  outerLoop:
  for (let i = 0; i < next.length; i++) {
    currentNode = current[i]
    for (let j = 0; j < current.length; j++) {
      if (current[j] === null) continue
      else if (current[j]!.nodeType === 3 && next[i].nodeType === 3) {
        console.log(
          "update text from",
          current[j].data,
          "to",
          next[i].data,
        )
        current[j].data = next[i].data
        next[i] = current[j]!
      } else if (current[j]!.isEqualNode(next[i])) {
        console.log("same nodes")
        next[i] = current[j]!
      }
      if (next[i] === current[j]) {
        current[j] = null
        if (i === j) continue outerLoop
        break
      }
    }
    elt?.insertBefore(next[i], currentNode?.nextSibling as any)
  }
  while (current.length) current.pop()?.remove()
}
