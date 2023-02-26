import { computed, inject, onDestroy, onMount, provider, signal } from "signals"
import { addElement, component, render, text } from "mod"

function onEvent<T extends keyof GlobalEventHandlersEventMap>(
  name: T,
  callback: (event: GlobalEventHandlersEventMap[T]) => void,
  options?: EventListenerOptions,
): void {
  onMount(() => addEventListener(name, callback, options))
  onDestroy(() => removeEventListener(name, callback, options))
}

const TriangleContext = provider(() => {
  const target = signal(1000)
  const elapsed = signal(0)
  const count = signal(0)
  const interval = signal(1000)
  const size = signal(25)
  const dots = signal(0)
  return {
    target,
    elapsed,
    count,
    interval,
    size,
    dots,
    scale: computed(() => {
      const e = (elapsed() / 1000) % 10
      return 1 + (e > 5 ? 10 - e : e) / 10
    }),
    countText: computed(() => count().toString()),
  }
})!

render(document.body, () => {
  const { target, interval, size } = inject(TriangleContext)
  onEvent("keyup", ({ key }) => {
    switch (key) {
      case "ArrowUp": {
        size(size() + 5)
        break
      }
      case "ArrowDown": {
        const next = size() - 5
        if (next >= 5) size(next)
        break
      }
      case "ArrowLeft": {
        target(target() - 50)
        break
      }
      case "ArrowRight": {
        target(target() + 50)
        break
      }
    }
  })

  Stats()

  TriangleDemo(target(), size(), interval())
})

const Stats = component(() => {
  const { target, size, interval, dots } = inject(TriangleContext)

  addElement("pre", (attr) => {
    attr.style = {
      zIndex: "1",
      position: "absolute",
      padding: "10px",
      margin: "10px",
      backgroundColor: "cornflowerblue",
      borderRadius: "10px",
    }
    text`Stats: 
  target: ${target()}
  size: ${size()}
  interval: ${interval()}
  dots: ${dots()}`
  })
})

const TriangleDemo = component(
  (target: number, size: number, interval: number) => {
    const { elapsed, count, scale } = inject(TriangleContext)
    let id: number

    onMount(() => {
      console.log("mount")
      id = setInterval(() => count((count() % 10) + 1), interval)
      const start = Date.now()
      const frame = () => {
        elapsed(Date.now() - start)
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })

    onDestroy(() => {
      console.log("destroy")
      clearInterval(id)
    })

    addElement("div", (attr) => {
      attr.id = "sierpinski-triangle"
      attr.class = "container"
      attr.style = () => `
        transform:
          scaleX(${scale() / 2.1}) 
          scaleY(0.7) 
          translateZ(0.1px)
      `
      Triangle(0, 0, target, size)
    })
  },
)

const Triangle = component((
  x: number,
  y: number,
  target: number,
  size: number,
) => {
  if (target <= size) return Dot(x, y, target)
  target = target / 2
  Triangle(x, y - target / 2, target, size)
  Triangle(x - target, y + target / 2, target, size)
  Triangle(x + target, y + target / 2, target, size)
})

const Dot = component((x: number, y: number, target: number) => {
  const { countText, dots } = inject(TriangleContext)
  const hover = signal(false)
  const mouseOut = () => hover(false)
  const mouseOver = () => hover(true)
  const text = () => hover() ? "*" + countText() + "*" : countText()
  const color = () => hover() === true ? "cornflowerblue" : "pink"

  onMount(() => dots(dots() + 1))
  onDestroy(() => dots(dots() - 1))

  addElement("div", (attr) => {
    attr.class = "dot"
    attr.onMouseOver = mouseOver
    attr.onMouseOut = mouseOut
    attr.textContent = text
    attr.style = {
      width: target + "px",
      height: target + "px",
      lineHeight: target + "px",
      backgroundColor: color,
      left: x + "px",
      top: y + "px",
      fontSize: (target / 2.5) + "px",
      borderRadius: target + "px",
    }
  })
})
