import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, MapPin, Trash2, Pencil, Home } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import type { Address } from "@/lib/db/types";
import { showToast } from "@/lib/toast";

type AddressForm = {
  id?: string;
  label: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  notes: string;
  is_default: boolean;
};

const emptyForm: AddressForm = {
  label: "",
  street: "",
  city: "",
  postal_code: "",
  country: "Maroc",
  notes: "",
  is_default: false,
};

export default function PatientAddressesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);

  const isEditing = Boolean(form.id);
  const canSave = useMemo(
    () => form.street.trim() && form.city.trim() && form.postal_code.trim() && form.country.trim(),
    [form]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const rows = await db.addresses.listForUser(user.id);
        if (active) setAddresses(rows);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Adresses indisponibles.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const resetForm = () => setForm(emptyForm);

  const handleEdit = (address: Address) => {
    setForm({
      id: address.id,
      label: address.label ?? "",
      street: address.street,
      city: address.city,
      postal_code: address.postal_code,
      country: address.country,
      notes: address.notes ?? "",
      is_default: address.is_default,
    });
  };

  const handleSave = async () => {
    if (!user?.id || saving || !canSave) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      if (form.id) {
        const updated = await db.addresses.update(form.id, {
          label: form.label.trim() || null,
          street: form.street.trim(),
          city: form.city.trim(),
          postal_code: form.postal_code.trim(),
          country: form.country.trim(),
          notes: form.notes.trim() || null,
          is_default: form.is_default,
        });
        if (form.is_default) {
          await db.addresses.setDefault(user.id, updated.id);
        }
        setAddresses((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        showToast("Adresse mise à jour.");
      } else {
        const created = await db.addresses.create({
          user_id: user.id,
          label: form.label.trim() || null,
          street: form.street.trim(),
          city: form.city.trim(),
          postal_code: form.postal_code.trim(),
          country: form.country.trim(),
          notes: form.notes.trim() || null,
          is_default: form.is_default,
        });
        if (form.is_default) {
          await db.addresses.setDefault(user.id, created.id);
        }
        setAddresses((prev) => [created, ...prev]);
        showToast("Adresse ajoutée.");
      }
      resetForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'enregistrer l'adresse.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addressId: string) => {
    Alert.alert("Supprimer", "Voulez-vous supprimer cette adresse ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await db.addresses.remove(addressId);
            setAddresses((prev) => prev.filter((row) => row.id !== addressId));
            showToast("Adresse supprimée.");
            if (form.id === addressId) resetForm();
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Suppression impossible.");
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user?.id) return;
    try {
      await db.addresses.setDefault(user.id, addressId);
      setAddresses((prev) =>
        prev.map((row) => ({ ...row, is_default: row.id === addressId }))
      );
      showToast("Adresse par défaut mise à jour.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Adresses enregistrées</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{isEditing ? "Modifier l'adresse" : "Ajouter une adresse"}</Text>
        <TextInput
          value={form.label}
          onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
          placeholder="Label (Maison, Travail...)"
          placeholderTextColor={Colors.textSubtle}
          style={styles.simpleInput}
        />
        <TextInput
          value={form.street}
          onChangeText={(value) => setForm((prev) => ({ ...prev, street: value }))}
          placeholder="Rue et numéro"
          placeholderTextColor={Colors.textSubtle}
          style={styles.simpleInput}
        />
        <View style={styles.row}>
          <TextInput
            value={form.city}
            onChangeText={(value) => setForm((prev) => ({ ...prev, city: value }))}
            placeholder="Ville"
            placeholderTextColor={Colors.textSubtle}
            style={[styles.simpleInput, styles.rowInput]}
          />
          <TextInput
            value={form.postal_code}
            onChangeText={(value) => setForm((prev) => ({ ...prev, postal_code: value }))}
            placeholder="Code postal"
            placeholderTextColor={Colors.textSubtle}
            style={[styles.simpleInput, styles.rowInput]}
          />
        </View>
        <TextInput
          value={form.country}
          onChangeText={(value) => setForm((prev) => ({ ...prev, country: value }))}
          placeholder="Pays"
          placeholderTextColor={Colors.textSubtle}
          style={styles.simpleInput}
        />
        <TextInput
          value={form.notes}
          onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          placeholder="Instructions (optionnel)"
          placeholderTextColor={Colors.textSubtle}
          style={styles.textArea}
          multiline
        />
        <TouchableOpacity
          style={[styles.defaultRow, form.is_default && styles.defaultRowActive]}
          onPress={() => setForm((prev) => ({ ...prev, is_default: !prev.is_default }))}
        >
          <Home size={16} color={form.is_default ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.defaultText, form.is_default && styles.defaultTextActive]}>
            Définir comme adresse par défaut
          </Text>
        </TouchableOpacity>
        <View style={styles.actionsRow}>
          {isEditing ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading &&
        addresses.map((address) => (
          <View key={address.id} style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressBadge}>
                <MapPin size={14} color={Colors.primary} />
              </View>
              <View style={styles.addressMeta}>
                <Text style={styles.addressTitle}>{address.label || "Adresse"}</Text>
                <Text style={styles.addressText}>
                  {address.street}, {address.city}
                </Text>
                <Text style={styles.addressText}>
                  {address.postal_code} · {address.country}
                </Text>
                {address.notes ? <Text style={styles.addressNote}>{address.notes}</Text> : null}
              </View>
              {address.is_default ? <Text style={styles.defaultBadge}>Par défaut</Text> : null}
            </View>
            <View style={styles.addressActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(address)}>
                <Pencil size={14} color={Colors.primary} />
                <Text style={styles.actionText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(address.id)}>
                <Trash2 size={14} color={Colors.danger} />
                <Text style={[styles.actionText, { color: Colors.danger }]}>Supprimer</Text>
              </TouchableOpacity>
              {!address.is_default ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleSetDefault(address.id)}>
                  <Home size={14} color={Colors.textMuted} />
                  <Text style={styles.actionText}>Définir défaut</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}

      {!loading && addresses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune adresse enregistrée.</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  center: { paddingVertical: 40, alignItems: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 14,
  },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 10 },
  simpleInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  rowInput: { flex: 1 },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  defaultRowActive: { borderColor: Colors.primary, backgroundColor: "#EEF2FF" },
  defaultText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  defaultTextActive: { color: Colors.primary },
  actionsRow: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  cancelBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },
  saveBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "white", fontSize: 13, fontWeight: "600" },
  addressCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 10,
  },
  addressHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  addressBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  addressMeta: { flex: 1 },
  addressTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  addressText: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  addressNote: { color: Colors.textSubtle, fontSize: 11, marginTop: 4 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E0F2FE",
    color: Colors.primary,
    fontSize: 10,
    overflow: "hidden",
  },
  addressActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  emptyCard: { backgroundColor: "white", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyText: { color: Colors.textMuted, fontSize: 12 },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 8 },
});
