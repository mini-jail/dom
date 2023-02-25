import { computed, inject, onDestroy, onMount, provider, signal } from "signals"
import { addElement, component, elRef, onEvent, render } from "mod"

const TriangleContext = provider(() => {
  const target = signal(1000)
  const elapsed = signal(0)
  const count = signal(0)
  const interval = signal(1000)
  const size = signal(25)
  return {
    target,
    elapsed,
    count,
    interval,
    size,
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
        size(size() + 50)
        break
      }
      case "ArrowDown": {
        size(size() - 50)
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

  TriangleDemo(target(), size(), interval())
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
      attr.style = {
        transform: () =>
          `scaleX(${scale() / 2.1}) scaleY(0.7) translateZ(0.1px)`,
      }
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
  const { countText } = inject(TriangleContext)
  const hover = signal(false)
  const click = signal(false)

  const mouseOut = () => hover(false)
  const mouseOver = () => hover(true)

  addElement("div", (attr) => {
    attr.class = "dot"
    attr.onMouseOver = mouseOver
    attr.onMouseOut = mouseOut
    attr.textContent = () => hover() ? "*" + countText() + "*" : countText()
    attr.style = {
      width: target + "px",
      height: target + "px",
      lineHeight: target + "px",
      backgroundColor: () =>
        hover() === true ? click() === true ? "red" : "cornflowerblue" : "pink",
      transform: () => click() ? "scale(2)" : "scale(1)",
      left: x + "px",
      top: y + "px",
      fontSize: (target / 2.5) + "px",
      borderRadius: target + "px",
    }
  })
})
