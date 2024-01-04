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
    : (
      /*H[Key] extends string
      ? (
        H[Key] extends `${infer X extends number}`
        ? (X | H[Key])
        : H[Key]
      )
      : */H[Key]
    )
  );
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
    if (typeof value == "function" && (name as string).startsWith("on"))
    {
      elem.addEventListener((name as string).slice(2), value.bind(elem));
    }
    else
    {
      (elem as any)[name] = value;
    }
  }

  for (const child of desc)
  {
    if (child && child.constructor.name.startsWith("HTML"))
    {
      elem.append(child as HTMLElement);
    }
    else
    {
      elem.append(String(child));
    }
  }

  return buildCreated(elem);
}

type ContainerDecl = {
  [key: string]: HTMLElement | [HTMLElement, ContainerDecl]
}

type Container<E extends HTMLElement, Decl extends ContainerDecl> = {
  [key in keyof Decl]:
  (
    Decl[key] extends [infer E extends HTMLElement, infer D extends ContainerDecl]
    ? Container<E, D>
    : Decl[key]
  )
} & {
  _: E
  _place(e: HTMLElement | Document): void;
}

function getContainerProperties(d: ContainerDecl):
{[key: string]: Container<HTMLElement, ContainerDecl> | Created<HTMLElement>}
{
  return Object.fromEntries(Object.entries(d).map(
    ([k, v]) => {
      if (Array.isArray(v))
      {
        return [k, Container(...v)];
      }
      return [k, v];
    }
  ));
}

export function Container<T extends ContainerDecl, E extends HTMLElement = HTMLElement>(
  _: E,
  d: T
): Container<E, T>
{
  return {
    ...getContainerProperties(d),
    _,
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
  } as Container<E, T>;
}