import {
  Accessor,
  Cleanup,
  cleanup,
  effect,
  mount,
  root,
} from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"

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
    effect<Record<string, any>>((attributes) => {
      const next: any[] = []
      const current: any[] = Array.from(elt.childNodes)
      const previousFgt = parentFgt
      parentFgt = next
      parentElt = elt
      options(attributes)
      for (const field in attributes) {
        elt[field as keyof typeof elt] = attributes[field]
      }
      let currentNode: ChildNode | null = null
      outerLoop:
      for (let i = 0; i < next.length; i++) {
        currentNode = current[i]
        for (let j = 0; j < current.length; j++) {
          if (current[j] === null) continue
          else if (current[j]!.nodeType === 3 && next[i].nodeType === 3) {
            console.log(
              "update text from %s to %s",
              current[j].data,
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

      parentFgt = previousFgt
      parentElt = undefined
      return attributes
    }, {})
  }
  if (parentFgt) parentFgt.push(elt)
  else parentElt?.appendChild(elt)
  parentElt = previousElt
}

export function addText(value: string | Accessor<string>): void {
  const node = new Text()
  if (typeof value === "function") {
    effect<string>((previous) => {
      const next = value()
      console.log("previous: %s, next: %s", previous, next)
      if (next !== previous) node.data = next
      return next
    })
  } else {
    node.data = value
  }
  if (parentFgt) parentFgt.push(node)
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
  const elt = elRef()
  mount(() => {
    console.log("listen %s", type)
    elt?.addEventListener(type, callback as EventListener)
  })
  cleanup(() => {
    console.log("unlisten %s", type)
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
