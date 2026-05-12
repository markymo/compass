import sys

with open("src/components/client/engagement/questionnaire-mapper.tsx", "r") as f:
    lines = f.readlines()

# Remove split view (lines 735-838, which are 0-indexed 734-837)
# And remove {viewMode === "grid" && ( from 841 (0-indexed 840)
# And remove )} from 848 (0-indexed 847)

del lines[847:848]
del lines[840:841]
del lines[734:838]

with open("src/components/client/engagement/questionnaire-mapper.tsx", "w") as f:
    f.writelines(lines)
