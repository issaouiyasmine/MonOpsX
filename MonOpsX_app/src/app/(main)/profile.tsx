import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppShell } from "@/components/app-shell";
import { FormField } from "@/components/form-field";
import { PrimaryButton } from "@/components/primary-button";
import { Permissions } from "@/constants/permissions";
import { colors, fonts, radii, spacing, typography } from "@/constants/theme";
import type { Profile } from "@/models/profile.model";
import { useAuth } from "@/providers/auth-provider";
import { useProfile } from "@/providers/profile-provider";
import { useToast } from "@/providers/toast-provider";
import { getApiErrorMessage } from "@/utils/api-error";
import { isValidEmail } from "@/utils/validation";

function ProfileForms({ data }: { data: Profile }){
 const{session}=useAuth(); const{updateUser,updateAccount}=useProfile(); const{showToast}=useToast();
 const[user,setUser]=useState({first_name:data.user.first_name,last_name:data.user.last_name,email:data.user.email}); const[account,setAccount]=useState({name:data.account.name,email:data.account.email}); const[savingUser,setSavingUser]=useState(false); const[savingAccount,setSavingAccount]=useState(false); const canEditAccount=session?.permissions.includes(Permissions.ACCOUNT_UPDATE)??false;
 async function saveUser(){if(!user.first_name.trim()||!user.last_name.trim()||!isValidEmail(user.email)){showToast("Vérifiez les informations utilisateur.","warning");return;}setSavingUser(true);try{await updateUser(user);showToast("Profil mis à jour.");}catch(e){showToast(getApiErrorMessage(e),"error");}finally{setSavingUser(false)}}
 async function saveAccount(){if(account.name.trim().length<3||!isValidEmail(account.email)){showToast("Vérifiez les informations de société.","warning");return;}setSavingAccount(true);try{await updateAccount(account);showToast("Société mise à jour.");}catch(e){showToast(getApiErrorMessage(e),"error");}finally{setSavingAccount(false)}}
 return <View style={styles.grid}><View style={styles.card}><Text style={styles.heading}>Informations utilisateur</Text><FormField label="Prénom" value={user.first_name} onChangeText={v=>setUser({...user,first_name:v})}/><FormField label="Nom" value={user.last_name} onChangeText={v=>setUser({...user,last_name:v})}/><FormField label="Adresse e-mail" keyboardType="email-address" value={user.email} onChangeText={v=>setUser({...user,email:v})}/><PrimaryButton label="Enregistrer le profil" loading={savingUser} onPress={saveUser}/></View><View style={styles.card}><Text style={styles.heading}>Informations société</Text><FormField editable={canEditAccount} label="Nom de la société" value={account.name} onChangeText={v=>setAccount({...account,name:v})}/><FormField editable={canEditAccount} label="E-mail de la société" keyboardType="email-address" value={account.email} onChangeText={v=>setAccount({...account,email:v})}/>{canEditAccount?<PrimaryButton label="Enregistrer la société" loading={savingAccount} onPress={saveAccount}/>:<Text style={styles.notice}>Vous pouvez consulter ces informations, mais votre rôle ne permet pas de les modifier.</Text>}</View></View>
}
export default function ProfilePage(){const{profile,load}=useProfile();const{showToast}=useToast();useEffect(()=>{if(!profile){const timeout=setTimeout(()=>{load().catch(e=>showToast(getApiErrorMessage(e),"error"))},0);return()=>clearTimeout(timeout)}},[profile,load,showToast]);return <AppShell title="Profil">{profile?<ProfileForms key={`${profile.user.email}-${profile.account.name}`} data={profile}/>:<ActivityIndicator color={colors.primary} style={{marginTop:80}}/>}</AppShell>}
const styles=StyleSheet.create({grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.lg},card:{flex:1,minWidth:300,maxWidth:620,backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,borderRadius:radii.large,padding:spacing.lg},heading:{color:colors.text,fontFamily:fonts.bold,fontSize:typography.h3,marginBottom:spacing.lg},notice:{color:colors.muted,fontFamily:fonts.regular,fontSize:typography.body,lineHeight:20}});
