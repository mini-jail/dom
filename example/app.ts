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

  view(() => {
    addElement("div", () => {
      const attr = attributesRef<"div">()!
      attr.id = "counter"
      attr.onClick = () => counter(counter() + 1)
      addText(`Button: ${counter()}`)
    })

    addElement("div", () => {
      addText("Sex")
    })
  })
})

render(document.body, () => {
  Button(100)
})
