<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## App architecture
- Public account pages reuse the Chakra auth view; private workspace pages live under the managed `_authenticated` gate to prevent signed-out access.
- Company profile reads and writes use authenticated server functions with owner-scoped policies and shared validation, so browser input cannot bypass access rules.
- Completed company profiles determine dashboard access; official links are optional to support companies without every social platform.
