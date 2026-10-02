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

- Store authorization roles separately from profiles and enforce room access in database policies, because client-visible identity fields are not authorization controls.
- Persist room access grants per user and revoke them when an administrator changes a room password, so remembered access remains secure.
- Use the Insert key as the default Push-to-Talk shortcut, keeping Space available for normal keyboard use.
