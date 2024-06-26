type ElementFunction<H extends HTMLElement, Key extends ((...args: any[])=> any)> = {
  (this: H, e: Parameters<Key>[0] & {
    target: H
  }): void | Promise<void>
}

type ElementAttr<H extends HTMLElement> = {
  [Key in keyof H]?: (
    Key extends `on${string}`
    ? (
      H[Key] extends (string | ((...args: any[])=> any) | null)
      ? ElementFunction<H, Exclude<H[Key], string | null>>
      : never
    )
    :
    Key extends "style"
    ? (ElementStyles | string)
    :
    Key extends ("step" | "min" | "max")
    ? (string | number)
    :
    Key extends ("value" | "defaultValue")
    ? (boolean | string | number)
    : (H[Key])
  ) 
  | null;
}

type OmitCSS = Omit<
  Partial<CSSStyleDeclaration>, "length" | "parentRule"
>;

type ElementStyles = {
  [Key in keyof OmitCSS]: OmitCSS[Key]
}

type Created<H extends HTMLElement> = H & {
  with(this: H, ...children: unknown[]): H
}

function buildCreated<H extends HTMLElement>(elem: H)
: Created<H>
{
  let e: Created<H> = elem as any;
  e.with = function(...args)
  {
    for (const child of args)
    {
      if (!child) continue;
      if (child && child.constructor.name.startsWith("HTML"))
      {
        this.append(child as HTMLElement);
      }
      else
      {
        this.append(String(child));
      }
    }
    return this;
  }

  return elem as any;
}

export function element<S extends keyof HTMLElementTagNameMap>(n: S, attr?: ElementAttr<HTMLElementTagNameMap[S]>, ...desc: unknown[]): Created<HTMLElementTagNameMap[S]>
export function element<H extends HTMLElement>(n: H["tagName"], attr?: ElementAttr<H>, ...desc: unknown[]): Created<H>
export function element(n: keyof HTMLElementTagNameMap, attr: any = {}, ...desc: unknown[]): Created<HTMLElement>
{
  const elem = document.createElement(n);

  for (const [name, value] of Object.entries(attr))
  {
    if (value === null || value === undefined) continue;
    if (typeof value == "function" && (name as string).startsWith("on"))
    {
      elem.addEventListener((name as string).slice(2), value.bind(elem));
    }
    if (name == "style")
    {
      if (typeof value == "string")
      {
        elem.setAttribute((name as string), value);
      }
      else if (typeof value == "object")
      {
        for (const [pName, pValue] of Object.entries(value) as [
          keyof ElementStyles, ElementStyles[keyof ElementStyles]
        ][])
        {
          elem.style[pName] = pValue as any;
        }
      }
    }
    else
    {
      (elem as any)[name] = value;
    }
  }
  const created = buildCreated(elem);
  created.with(...desc);

  return created;
}

type ContainerChild = Container<any, any> | HTMLElement | Created<HTMLElement> | [HTMLElement | Created<HTMLElement>, ContainerDecl];

type ContainerDecl = {
  [key: string]: ContainerChild
}

type ContainerState = {
  [key: string]: any
}

type Container<
  E extends HTMLElement, 
  Decl extends ContainerDecl,
  State extends ContainerState = ContainerState
> = {
  [key in keyof Decl]:
  (
    Decl[key] extends [infer E extends HTMLElement, infer D extends ContainerDecl, infer S extends ContainerState]
    ? Container<E, D, S>
    : 
    Decl[key] extends [infer E extends HTMLElement, infer D extends ContainerDecl]
    ? Container<E, D>
    : Decl[key]
  )
} & {
  _: E
  _place(e: HTMLElement | Document): void;
  _state: State
}

export function isContainer<E extends HTMLElement, Decl extends ContainerDecl, State extends ContainerState>(x: unknown): x is Container<E, Decl, State>
{
  return !!x && typeof x == "object" && "__type" in x && x.__type === CONTAINER_TYPE;
}

function getContainerProperties(d: ContainerDecl):
{[key: string]: Container<HTMLElement, ContainerDecl, ContainerState> | Created<HTMLElement>}
{
  return Object.fromEntries(Object.entries(d).map(
    ([k, v]) => {
      if (Array.isArray(v))
      {
        return [k, Container<any, any>(...v)];
      }
      else
      {
        return [k, v as HTMLElement | Created<HTMLElement>];
      }
    }
  ));
}

const CONTAINER_TYPE = Symbol("container");

export function Container<T extends ContainerDecl, E extends HTMLElement = HTMLElement, S extends ContainerState = ContainerState>(
  _: E,
  d: T,
  _state: S = {} as S
): Container<E, T, S>
{
  return {
    ...getContainerProperties(d),
    __type: CONTAINER_TYPE,
    _,
    _state,
    _place(e)
    {
      for (const [n, ch] of Object.entries(this))
      {
        if ((n as string).startsWith("_")) continue;

        if (ch.constructor.name.startsWith("HTML"))
        {
          this._.append(ch as HTMLElement)
        }
        else
        {
          (ch as Container<any, any>)._place(this._);
        }
      }
      e.append(this._);
    }
  } as Container<E, T, S>;
}

export function css(props: ElementStyles): string
{
  let str = "";
  for (const [name, value] of Object.entries(props) as [string, any][])
  {
    const propName = name
    .split(/(?=[A-Z])/)
    .map(s => s.toLowerCase())
    .join("-");

    str += `${propName}: ${value};`
  }
  return str;
}
