import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Badge, Button, Card, Screen, SectionHeader, Subtitle, Title } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { getPlayerName, setPlayerName } from "@/state/session";
import { prewarmBackend } from "@/api/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  useEffect(() => {
    let mounted = true;
    getPlayerName().then((value) => mounted && setName(value)).catch(() => undefined);
    prewarmBackend();
    return () => { mounted = false; };
  }, []);
  const persistName = (value: string) => { setName(value); setPlayerName(value).catch(() => undefined); };
  return (
    <Screen>
      <View style={styles.brandRow}><View style={styles.mark}><Text style={styles.markText}>C</Text></View><Text style={styles.eyebrow}>CRAFTTOGETHER</Text><Badge tone="success">BETA</Badge></View>
      <Title>Jogue junto, de qualquer lugar.</Title>
      <Subtitle>Encontre mundos, crie uma sala e conecte seu Minecraft Bedrock com seus amigos.</Subtitle>
      <Card style={styles.identity}>
        <Text style={styles.label}>COMO VOCÊ SERÁ VISTO</Text>
        <TextInput value={name} onChangeText={persistName} placeholder="Digite seu nome" placeholderTextColor={colors.textMuted} style={styles.input} maxLength={32} />
      </Card>
      <Button label="Criar uma sala" onPress={() => router.push("/create")} />
      <Button label="Encontrar servidores" variant="secondary" onPress={() => router.push("/rooms")} />
      <View style={styles.quickGrid}><Card style={styles.quick}><Text style={styles.quickIcon}>+</Text><Text style={styles.quickTitle}>Amigos</Text><Text style={styles.quickHint}>Código e convites</Text><Button label="Abrir" variant="secondary" onPress={() => router.push("/friends")} /></Card><Card style={styles.quick}><Text style={styles.quickIcon}>?</Text><Text style={styles.quickTitle}>Guia rápido</Text><Text style={styles.quickHint}>Como conectar</Text><Button label="Ler" variant="secondary" onPress={() => router.push("/guide")} /></Card></View>
      <SectionHeader title="Sua atividade" action="Perfil" onAction={() => router.push("/profile")} />
      <Card><Text style={styles.emptyTitle}>Pronto para começar?</Text><Text style={styles.emptyText}>Suas salas recentes e favoritos aparecerão aqui depois da primeira partida.</Text></Card>
      <Text style={styles.disclaimer}>Não oficial e sem vínculo com Mojang ou Microsoft. Use uma cópia legal do Minecraft.</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({ brandRow:{flexDirection:"row",alignItems:"center",gap:spacing.sm},mark:{width:32,height:32,borderRadius:10,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},markText:{color:colors.bg,fontSize:20,fontWeight:"900"},eyebrow:{color:colors.textMuted,fontSize:12,fontWeight:"900",letterSpacing:1.5,flex:1},identity:{marginTop:spacing.sm},label:{color:colors.textMuted,fontSize:11,fontWeight:"800",letterSpacing:1},input:{backgroundColor:colors.bg,borderColor:colors.cardBorder,borderWidth:1,borderRadius:radius.sm,color:colors.text,paddingHorizontal:spacing.md,paddingVertical:12,fontSize:16},quickGrid:{flexDirection:"row",gap:spacing.md},quick:{flex:1},quickIcon:{color:colors.primary,fontSize:26,fontWeight:"700"},quickTitle:{color:colors.text,fontSize:16,fontWeight:"800"},quickHint:{color:colors.textMuted,fontSize:12,flex:1},emptyTitle:{color:colors.text,fontSize:16,fontWeight:"800"},emptyText:{color:colors.textMuted,fontSize:13,lineHeight:19},disclaimer:{color:colors.textMuted,fontSize:11,lineHeight:16,textAlign:"center",marginTop:spacing.sm}});

