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
      const $ = attributesRef<"div">()!
      $.id = "counter"
      $.onClick = () => counter(counter() + 1)
      addText(`Button: ${counter()}`)

      addElement("a", () => {
        const $ = attributesRef()!
        $.class = "sex"
      })
    })
  })
})

render(document.body, () => {
  Button(100)
})
