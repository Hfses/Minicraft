import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Screen, Subtitle, Title } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { getFriendCode, getPlayerName } from "@/state/session";

export default function Profile() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => { Promise.all([getPlayerName(), getFriendCode()]).then(([playerName, friendCode]) => { setName(playerName); setCode(friendCode); }).catch(() => undefined); }, []);
  return <Screen><Title>Seu perfil</Title><Subtitle>Sua identidade local no CraftTogether. Não é preciso criar uma conta para jogar.</Subtitle><Card style={styles.hero}><View style={styles.avatar}><Text style={styles.avatarText}>{(name || "?").slice(0, 1).toUpperCase()}</Text></View><Text style={styles.name}>{name || "Jogador"}</Text><Text style={styles.status}>Disponível para jogar</Text></Card><Card><Text style={styles.label}>CÓDIGO DE AMIGO</Text><Text style={styles.code}>{code || "Gerando…"}</Text><Text style={styles.hint}>Compartilhe este código para facilitar convites no futuro.</Text></Card><Card><Text style={styles.label}>ESTATÍSTICAS</Text><View style={styles.stats}><View><Text style={styles.statValue}>0</Text><Text style={styles.hint}>salas criadas</Text></View><View><Text style={styles.statValue}>0</Text><Text style={styles.hint}>partidas</Text></View><View><Text style={styles.statValue}>0 h</Text><Text style={styles.hint}>tempo jogado</Text></View></View></Card><Button label="Voltar ao início" variant="secondary" onPress={() => router.replace("/")} /></Screen>;
}
const styles = StyleSheet.create({hero:{alignItems:"center",paddingVertical:spacing.lg},avatar:{width:72,height:72,borderRadius:36,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},avatarText:{color:colors.bg,fontSize:32,fontWeight:"900"},name:{color:colors.text,fontSize:24,fontWeight:"800",marginTop:spacing.sm},status:{color:colors.primary,fontSize:13,fontWeight:"700"},label:{color:colors.textMuted,fontSize:11,fontWeight:"800",letterSpacing:1},code:{color:colors.accent,fontSize:28,fontWeight:"900",letterSpacing:4,marginTop:spacing.sm},hint:{color:colors.textMuted,fontSize:12,lineHeight:18},stats:{flexDirection:"row",justifyContent:"space-between",marginTop:spacing.md},statValue:{color:colors.text,fontSize:22,fontWeight:"800"}});
