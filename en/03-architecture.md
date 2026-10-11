# 3. Product Architecture

DI’s architecture connects a common model foundation, three product capabilities, and subsequent Personal Agent and Agent network stages. The model supplies the shared foundation; products perform specific work; Personal Agents organize capabilities around user tasks; the network connects Agents belonging to different users.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#17140f", "primaryTextColor": "#eee9d9", "primaryBorderColor": "#b59658", "lineColor": "#b59658", "secondaryColor": "#211c12", "tertiaryColor": "#17140f", "edgeLabelBackground": "#17140f", "fontFamily": "Arial, sans-serif"}}}%%
flowchart BT
    M["Crypto-native Model and data foundation"] --> D["Data Dashboard"]
    M --> E["Event Engine"]
    M --> Q["Quant Platform"]
    D --> P["Personal Agents · After launch"]
    E --> P
    Q --> P
    P --> N["Agent network · Seed-user phase"]
```

## One foundation, three products

The Data Dashboard, Event Engine and Quant Platform perform different work while sharing a crypto market data and model foundation. Users can access one capability independently or combine several according to the task.

The dashboard can be used independently for discovery. Event Engine can start with a question entered directly by a user. The Quant Platform provides both DI products and tools for users to create and publish strategy products.

## Personal Agents as the user’s interface

In the next stage, a Personal Agent will call these capabilities according to the task. A task may require only data monitoring, or combine event research with strategy analysis. The Agent will organize the work and its context while calling the underlying product capabilities.

## A network across users

The Agent network will develop after Personal Agents take shape. Its central relationships are communication, information exchange, capability calls and collaborative tasks between Agents.

Multi-persona discussion in Event Engine focuses on a research question. The financial Agent network connects Agents serving different users over time, enabling capability calls and collaboration across users.
