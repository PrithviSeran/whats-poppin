// ... existing code ...
  const handleResetPassword = async () => {
    if (!validatePassword(password) || !validateConfirmPassword(confirmPassword)) return;

    setIsLoading(true);
    setSuccessMessage('');

    try {
      // Get the session from the URL
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setPasswordError('Please use the password reset link from your email');
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setPasswordError(updateError.message);
      } else {
        setSuccessMessage('Password has been reset successfully');
        setTimeout(() => {
          navigation.navigate('social-sign-in');
        }, 2000);
      }
    } catch (error) {
      setPasswordError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
// ... existing code ...
