# Firebase iOS config (push notifications)

Firebase Console → Project settings → Add app → iOS, twice:

| Folder      | Bundle ID                   |
|-------------|-----------------------------|
| `passenger/`| `uz.angren.taxi.passenger`  |
| `driver/`   | `uz.angren.taxi.driver`     |

Download each `GoogleService-Info.plist` into the matching folder. The
"Copy GoogleService-Info.plist" build phase picks the right one from the
build configuration (`Release-driver` → `driver/`). Without the file the app
still builds and runs; only push notifications are disabled.

Also upload an APNs Auth Key (.p8) under Firebase → Cloud Messaging → Apple
app configuration, for both apps.
