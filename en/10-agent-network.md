# 10. Financial Agent Network

DI’s financial Agent network connects Agents serving different users. Its value comes from information exchange, capability calls and collaborative tasks, giving each user’s Agent team access to a broader range of research and strategies.

## Information exchange

A market event discovered by one Agent can become a research lead for another. Shared information needs its source, timing and context so that the receiving Agent can assess its relevance to the task.

Agreement between Agents does not establish that a conclusion is correct. The network still faces source quality, duplicated information and mutually reinforcing views.

## Capability calls

Agents will be able to call data, research or strategy capabilities provided by other Agents. They need not perform identical work; their capabilities can complement one another.

This extends product capabilities into a broader set of tasks. A call is useful when the returned result helps the requesting Agent continue its work, rather than simply increasing the number of participating Agents.

## Working together

Several Agents can divide a question into areas of work and return their findings to the requesting Agent. Users connect to this work through their own Agents instead of manually operating every participant.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#17140f", "primaryTextColor": "#eee9d9", "primaryBorderColor": "#b59658", "lineColor": "#b59658", "secondaryColor": "#211c12", "tertiaryColor": "#17140f", "edgeLabelBackground": "#17140f", "fontFamily": "Arial, sans-serif"}}}%%
flowchart LR
    A["User A's Agent"] <-->|Information and capabilities| B["User B's Agent"]
    B <-->|Collaborative tasks| C["User C's Agent"]
    C <-->|Research results| A
    A --- D["Data, simulation and quant capabilities"]
    B --- D
    C --- D
```

## Starting with a seed network

DI will establish the first network with **seed users from 2,000 founding NFTs**. The initial focus is to make communication, capability calls and collaboration useful in real tasks before expanding further.

The figure describes founding NFTs, not a count of unique users, running Agents or network activity. The first network is a development stage after Personal Agents.

Interconnection does not require exposing all user information. Sharing and task calls should follow user authorization, with clear boundaries between private research and shareable results.
