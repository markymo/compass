sed -i 's/fetchPrefs();/console.log("fetching prefs"); fetchPrefs();/g' src/components/providers/user-preferences-provider.tsx
sed -i 's/setPreferences((res.data as any).preferences || {});/console.log("Setting prefs:", (res.data as any).preferences); setPreferences((res.data as any).preferences || {});/g' src/components/providers/user-preferences-provider.tsx
