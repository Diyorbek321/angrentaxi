# R8/ProGuard rules for the release build.
#
# minifyEnabled/shrinkResources are on, so anything reached only by reflection
# has to be kept explicitly.

# Flutter engine + embedding
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Firebase Cloud Messaging (message handlers are instantiated reflectively)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**

# Geolocator foreground service
-keep class com.baseflow.geolocator.** { *; }

# flutter_secure_storage delegates to androidx.security.crypto
-keep class androidx.security.crypto.** { *; }

# Keep annotations used for JSON/reflection across plugins
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod

# Line numbers make Play Console crash reports readable; the source file name
# itself is hidden.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
