## Summary

- What changed:
- Why it changed:
- Risk level: Low / Medium / High

## Validation

- [ ] Local checks/tests run (list below)
- [ ] No unintended runtime behavior changes

### Verification Notes

- Commands/tests executed:
- Key outputs/results:

## Docs-First Planning Gate (required before implementation)

- [ ] `Docs Needed` list declared before implementation details (with reason per doc)
- [ ] Doc sufficiency assessed for major decisions (`Sufficient` / `Insufficient`)
- [ ] `Decision Evidence Log` completed for major decisions

### Docs Needed

| Doc path | Why needed |
| --- | --- |
| `<docs/...>` | `<decision or scope dependency>` |

### Decision Evidence Log

| Decision | Docs cited | Sufficiency verdict | Fallback code scan used? | Doc update action |
| --- | --- | --- | --- | --- |
| `<decision>` | `<doc paths>` | `Sufficient` / `Insufficient` | `No` / `Yes (reason)` | `None` / `<update target or blocker owner+date>` |

## Documentation Impact

- [ ] No documentation impact
- [ ] Documentation updated in this PR
- [ ] New docs added

### If docs changed, confirm all that apply

- [ ] Canonical docs were updated (not only planning docs)
- [ ] Any new/changed rules were added to the correct domain doc under `docs/`
- [ ] Invariants and procedures are separated (procedures in `docs/workflow/*-workflow.md`)

### New-doc registration gate (required for every new doc)

For each new doc added in this PR, confirm:

- [ ] Registered in `docs/ai/assistant-context-index.md`
- [ ] Routed from `docs/ai/guide.md`
- [ ] Includes `Source of truth` metadata
- [ ] Includes `## Related Docs` section with outbound links

## Backward Compatibility / Rollback

- [ ] Backward compatible
- [ ] Rollback steps documented (if needed)

### Rollback Notes

- Safe rollback approach:
- Data/backfill considerations:
