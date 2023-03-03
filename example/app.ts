import { signal } from "https://raw.githubusercontent.com/mini-jail/signal/main/mod.ts"
import {
  addElement,
  addText,
  attributesRef,
  component,
  render,
  view,
} from "../mod.ts"

const Button = component((init: number) => {
  const counter = signal(init)

  addElement("div", () => {
    const $ = attributesRef<"div">()!
    $.id = "counter"
    $.onClick = () => counter(counter() + 1)
    view(() => addText(`Button: ${counter()}`))
  })
})

render(document.body, () => {
  Button(100)
})
