# Models are decoded by kotlinx.serialization; keep their generated serializers.
-keepattributes *Annotation*, InnerClasses
-keepclassmembers @kotlinx.serialization.Serializable class com.praveenjuge.neram.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
# Convex's native client is loaded through JNA.
-keep class com.sun.jna.** { *; }
-keep class uniffi.** { *; }
-keep class dev.convex.** { *; }
