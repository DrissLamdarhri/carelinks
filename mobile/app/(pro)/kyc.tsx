/**
 * KYC Document Upload — replaces KycUploader.tsx (web).
 * Uses expo-document-picker + expo-image-picker → Supabase Storage.
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Upload, CheckCircle, Clock, XCircle, FileText } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../../shared/auth-context";
import { db } from "../../../shared/db/dal";
import { supabase } from "../../../shared/supabase";
import type { ProDocument } from "../../../shared/db/types";

const DOC_TYPES = [
  { key: "diploma", label: "Diplôme / Certificat" },
  { key: "license", label: "Autorisation d'exercer" },
  { key: "id", label: "Pièce d'identité" },
];

export default function KycScreen() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadDocuments();
  }, [user]);

  const loadDocuments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await db.proDocuments.listForPro(user.id);
      setDocuments(docs);
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (docType: string) => {
    if (!user) return;

    // Choose source
    const choice = await new Promise<"camera" | "gallery" | "file" | null>(
      (resolve) => {
        Alert.alert("Ajouter un document", "Choisissez la source :", [
          {
            text: "Prendre une photo",
            onPress: () => resolve("camera"),
          },
          {
            text: "Galerie photos",
            onPress: () => resolve("gallery"),
          },
          {
            text: "Fichier PDF",
            onPress: () => resolve("file"),
          },
          { text: "Annuler", style: "cancel", onPress: () => resolve(null) },
        ]);
      }
    );

    if (!choice) return;

    setUploading(docType);

    try {
      let fileUri: string | null = null;
      let fileName: string = `${docType}_${Date.now()}`;
      let mimeType: string = "image/jpeg";

      if (choice === "camera" || choice === "gallery") {
        const result =
          choice === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: true,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
              });

        if (result.canceled || !result.assets?.[0]) return;
        fileUri = result.assets[0].uri;
        const ext = fileUri.split(".").pop() ?? "jpg";
        fileName = `${docType}_${Date.now()}.${ext}`;
        mimeType = `image/${ext}`;
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        fileUri = result.assets[0].uri;
        fileName = result.assets[0].name ?? `${docType}_${Date.now()}.pdf`;
        mimeType = result.assets[0].mimeType ?? "application/pdf";
      }

      if (!fileUri) return;

      const storagePath = `kyc/${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const response = await fetch(fileUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("pro-documents")
        .upload(storagePath, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Save record in DB
      await db.proDocuments.create({
        professional_id: user.id,
        doc_type: docType,
        storage_path: storagePath,
      });

      await loadDocuments();
      Alert.alert("Téléchargé !", "Votre document a été envoyé pour vérification.");
    } catch (err: any) {
      Alert.alert("Erreur upload", err.message);
    } finally {
      setUploading(null);
    }
  };

  const getDocForType = (type: string) =>
    documents.find((d) => d.doc_type === type);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="bg-primary px-5 py-4">
        <Text
          className="text-surface text-xl"
          style={{ fontFamily: "DMSerifDisplay_400Regular" }}
        >
          Vérification KYC
        </Text>
        <Text
          className="text-accent text-sm mt-1"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          Téléchargez vos documents pour être vérifié
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0D0870" size="large" />
        </View>
      ) : (
        <FlatList
          data={DOC_TYPES}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item: docType }) => {
            const uploaded = getDocForType(docType.key);
            const isUploading = uploading === docType.key;

            return (
              <View className="bg-white rounded-2xl p-5 shadow-sm">
                <View className="flex-row items-center mb-4">
                  <FileText color="#0D0870" size={20} strokeWidth={1.5} />
                  <Text
                    className="flex-1 text-primary text-base ml-3"
                    style={{ fontFamily: "DMSans_500Medium" }}
                  >
                    {docType.label}
                  </Text>
                  {uploaded && (
                    <View className="flex-row items-center gap-1">
                      {uploaded.is_verified ? (
                        <>
                          <CheckCircle color="#10B981" size={16} strokeWidth={1.5} />
                          <Text
                            className="text-green-600 text-xs"
                            style={{ fontFamily: "DMSans_500Medium" }}
                          >
                            Vérifié
                          </Text>
                        </>
                      ) : (
                        <>
                          <Clock color="#F59E0B" size={16} strokeWidth={1.5} />
                          <Text
                            className="text-yellow-600 text-xs"
                            style={{ fontFamily: "DMSans_500Medium" }}
                          >
                            En attente
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </View>

                {uploaded && (
                  <Text
                    className="text-muted text-xs mb-4"
                    style={{ fontFamily: "DMSans_400Regular" }}
                  >
                    Envoyé le{" "}
                    {new Date(uploaded.uploaded_at).toLocaleDateString("fr-MA")}
                  </Text>
                )}

                <TouchableOpacity
                  className={`flex-row items-center justify-center gap-2 py-3 rounded-xl ${
                    uploaded ? "bg-gray-100" : "bg-primary"
                  }`}
                  onPress={() => uploadDocument(docType.key)}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator
                      color={uploaded ? "#0D0870" : "#EDE5CC"}
                      size="small"
                    />
                  ) : (
                    <>
                      <Upload
                        color={uploaded ? "#0D0870" : "#EDE5CC"}
                        size={16}
                        strokeWidth={1.5}
                      />
                      <Text
                        className={uploaded ? "text-primary" : "text-surface"}
                        style={{ fontFamily: "DMSans_500Medium" }}
                      >
                        {uploaded ? "Remplacer" : "Télécharger"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
