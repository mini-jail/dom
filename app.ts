import { signal, Signal } from "https://raw.githubusercontent.com/mini-jail/signals/main/mod.ts"
import {
  addElement,
  addEvent,
  addText,
  component,
  render,
  setAttribute,
} from "./mod.ts"

const Button = component((text: Signal<string>) => {
  addElement("div", () => {
    addElement("button", () => {
      addText("klick mich")
      addEvent("click", () => text(prompt("new text")!))
    })
  })
})

const App = component((text: Signal<string>) => {
  addElement("h2", () => {
    setAttribute("style", "color: pink")
    addText("nicer dicer evolution")
  })

  Button(text)

  addText(() => text() === "cool" ? "sehr cool": "")

  addElement("div", () => {
    setAttribute("style", "font-weight: bold")
    addText(text)
  })

  addElement("div", () => {
    addElement("i", (attr) => {
      attr.textContent = "LETZTER :D"
      addText(text)
    })
  })

  addText(text)
})

render(document.body, () => {
  const text = signal("hello world")
  
  setAttribute("style", "background-color: ghostwhite")
  addElement("h1", () => {
    setAttribute("style", "color: cornflowerblue")
    addText("App")
  })
  App(text)
})
